import { getCloudflareContext } from "@opennextjs/cloudflare"
import { NextResponse } from "next/server"
import puppeteer, {
  type ActiveSession,
  type Browser,
  type BrowserWorker,
  type Page,
} from "@cloudflare/puppeteer"
import { z } from "zod/v4"

import { captureUrlSchema } from "@/lib/editor/capture-url"
import { env } from "@/lib/env"
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"

const ASPECT_RATIOS = ["4:3", "3:4", "16:9", "1:1", "9:16", "9:19.5"] as const

const requestSchema = z.object({
  url: captureUrlSchema,
  device: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
  width: z.number().int().min(320).max(3840),
  aspectRatio: z.enum(ASPECT_RATIOS),
  delay: z.enum(["none", "2s", "5s"]).default("none"),
})

// Land entrance/scroll-reveal animations on their final frame instead of a
// blank half-played one. Screenshotting the resting state is what we want, so
// collapse every animation/transition to ~0 duration with no delay. This is
// the same trick Playwright uses for `animations: "disabled"`.
const FREEZE_ANIMATIONS_CSS = [
  "*, *::before, *::after {",
  "  animation-duration: 0s !important;",
  "  animation-delay: 0s !important;",
  "  animation-iteration-count: 1 !important;",
  "  transition-duration: 0s !important;",
  "  transition-delay: 0s !important;",
  "  scroll-behavior: auto !important;",
  "}",
].join("\n")

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const TABLET_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const SCREENSHOT_CACHE_TTL_SECONDS = 300
const MAX_SCREENSHOT_CACHE_ENTRIES = 30
const SCREENSHOT_NAVIGATION_TIMEOUT_MS = 30000
// Overall budget for the REST fallback's HTTP call to Cloudflare.
const SCREENSHOT_REQUEST_TIMEOUT_MS = 45000
// Keep a launched browser warm so back-to-back captures reuse the session
// instead of paying a cold start (and hitting Cloudflare's per-minute launch
// cap) every request.
const BROWSER_KEEP_ALIVE_MS = 120000
// Upper bound on the top-to-bottom scroll pass so a very tall or endlessly
// lazy-loading page can't stall the request.
const SCROLL_BUDGET_MS = 8000

type ScreenshotCacheEntry = {
  buffer: ArrayBuffer
  expiresAt: number
}

const screenshotCache = new Map<string, ScreenshotCacheEntry>()

function heightFromAspect(
  width: number,
  aspectRatio: (typeof ASPECT_RATIOS)[number]
) {
  const [w, h] = aspectRatio.split(":").map((n) => Number(n))
  return Math.round((width * h) / w)
}

function delayMsFromSetting(delay: z.infer<typeof requestSchema>["delay"]) {
  if (delay === "2s") return 2000
  if (delay === "5s") return 5000
  return 0
}

function getBrowserBinding(): BrowserWorker | null {
  // TOKOKINO_BROWSER lives only in the generated cloudflare-env.d.ts, not the
  // committed CloudflareEnv type, so read it through a local shape rather than
  // as a typed property (keeps CI typecheck green without cf-typegen). The
  // runtime object is a `{ fetch }`, which is exactly puppeteer's BrowserWorker.
  const env = getCloudflareContext().env as unknown as {
    TOKOKINO_BROWSER?: BrowserWorker
  }
  return env.TOKOKINO_BROWSER ?? null
}

// Reuse an idle browser session when one is free; otherwise launch a fresh one.
// Reconnecting avoids a multi-second cold start and stays under the account's
// new-browser-per-minute limit.
async function acquireBrowser(binding: BrowserWorker): Promise<Browser> {
  const sessions = await puppeteer
    .sessions(binding)
    .catch(() => [] as ActiveSession[])
  const free = sessions.find((session) => !session.connectionId)
  if (free) {
    try {
      return await puppeteer.connect(binding, free.sessionId)
    } catch {
      // Session was reaped between listing and connecting — fall back to launch.
    }
  }
  return puppeteer.launch(binding, { keep_alive: BROWSER_KEEP_ALIVE_MS })
}

// Drive the page top-to-bottom so scroll-triggered reveals fire and lazy media
// load, then return to the top. Returning to the top is what `scrollPage` (the
// REST option) can't do: it restores sticky/hide-on-scroll navbars and resets
// scroll-linked effects to a coherent baseline before the full-page capture.
async function scrollThroughPage(page: Page) {
  await page.evaluate(async (budgetMs: number) => {
    const g = globalThis as unknown as {
      innerHeight: number
      scrollY: number
      scrollTo: (x: number, y: number) => void
      document: { body: { scrollHeight: number } }
    }
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms))
    const step = Math.max(200, Math.floor(g.innerHeight * 0.85))
    const start = Date.now()
    let last = -1
    for (let y = 0; y < g.document.body.scrollHeight; y += step) {
      g.scrollTo(0, y)
      // Give IntersectionObserver reveals and lazy loaders a frame to react.
      await sleep(70)
      if (Date.now() - start > budgetMs) break
      // Reached the bottom (scroll position stopped advancing) — stop early.
      if (g.scrollY === last) break
      last = g.scrollY
    }
    g.scrollTo(0, 0)
    // Let sticky headers slide back and revealed content settle.
    await sleep(200)
  }, SCROLL_BUDGET_MS)
}

type CaptureParams = {
  url: string
  userAgent: string
  width: number
  height: number
  isMobile: boolean
  hasTouch: boolean
  extraSettleMs: number
}

type RestConfig = { accountId: string; apiToken: string }

// Carries an HTTP status so REST failures (429, 504, …) surface faithfully
// instead of collapsing to a generic 500.
class CaptureError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function getRestConfig(): RestConfig | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_BROWSER_API_TOKEN
  if (!accountId || !apiToken) return null
  return { accountId, apiToken }
}

// Full-fidelity capture via the Workers browser binding: settle the network,
// freeze animations, scroll through and back to the top, then grab the page.
async function captureViaBinding(
  binding: BrowserWorker,
  params: CaptureParams
): Promise<ArrayBuffer> {
  const browser = await acquireBrowser(binding)
  let succeeded = false
  try {
    const page = await browser.newPage()
    await page.setUserAgent(params.userAgent)
    await page.setViewport({
      width: params.width,
      height: params.height,
      deviceScaleFactor: 2,
      isMobile: params.isMobile,
      hasTouch: params.hasTouch,
    })
    // Wait for the network to settle rather than firing on the load event, so
    // JS-rendered content is present without a blind fixed delay.
    await page.goto(params.url, {
      waitUntil: "networkidle2",
      timeout: SCREENSHOT_NAVIGATION_TIMEOUT_MS,
    })
    await page.addStyleTag({ content: FREEZE_ANIMATIONS_CSS })
    await scrollThroughPage(page)
    if (params.extraSettleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, params.extraSettleMs))
    }
    const shot = await page.screenshot({ type: "png", fullPage: true })
    const buffer = shot.buffer.slice(
      shot.byteOffset,
      shot.byteOffset + shot.byteLength
    ) as ArrayBuffer
    await page.close().catch(() => undefined)
    succeeded = true
    return buffer
  } finally {
    // Leave a healthy session warm for reuse; tear a failed one down since it
    // may be in a bad state.
    if (succeeded) browser.disconnect().catch(() => undefined)
    else await browser.close().catch(() => undefined)
  }
}

// Local-dev fallback via the Browser Rendering REST API. Can't scroll-through
// (the REST endpoint runs injected scripts synchronously), so this is a
// lower-fidelity capture — networkidle2 + freeze-animations only.
async function captureViaRest(
  config: RestConfig,
  params: CaptureParams
): Promise<ArrayBuffer> {
  const endpoint = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/browser-rendering/screenshot`
  )
  endpoint.searchParams.set("cacheTTL", String(SCREENSHOT_CACHE_TTL_SECONDS))

  const body = {
    url: params.url,
    viewport: {
      width: params.width,
      height: params.height,
      deviceScaleFactor: 2,
      isMobile: params.isMobile,
      hasTouch: params.hasTouch,
    },
    userAgent: params.userAgent,
    screenshotOptions: {
      type: "png",
      fullPage: true,
      captureBeyondViewport: false,
    },
    addStyleTag: [{ content: FREEZE_ANIMATIONS_CSS }],
    gotoOptions: {
      waitUntil: "networkidle2",
      timeout: SCREENSHOT_NAVIGATION_TIMEOUT_MS,
    },
    ...(params.extraSettleMs > 0
      ? { waitForTimeout: params.extraSettleMs }
      : {}),
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "image/png",
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SCREENSHOT_REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new CaptureError(
        "The site took too long to load. Try a different URL or try again.",
        504
      )
    }
    throw err
  }

  if (!response.ok) {
    throw new CaptureError(await parseRestError(response), response.status)
  }
  return response.arrayBuffer()
}

async function parseRestError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await response.json().catch(() => null)) as {
      errors?: Array<{ code?: number; message?: string }>
    } | null
    // 6002 = navigation timeout from Cloudflare's renderer.
    if (body?.errors?.some((entry) => entry.code === 6002)) {
      return "The site took too long to load. Try a different URL or try again."
    }
    const message = body?.errors?.find((entry) => entry.message)?.message
    if (message) return message
  }
  return response.statusText || "Capture failed"
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    limiter: "HEAVY_RATE_LIMITER",
    scope: "screenshot",
    id: getClientIp(request.headers),
  })
  if (limited) return limited

  const binding = getBrowserBinding()
  const restConfig = getRestConfig()
  if (!binding && !restConfig) {
    return NextResponse.json(
      {
        error:
          "Screenshot capture isn't configured. Add the TOKOKINO_BROWSER browser-rendering binding (or set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_BROWSER_API_TOKEN for local dev).",
      },
      { status: 503 }
    )
  }

  let payload: z.infer<typeof requestSchema>
  try {
    const result = requestSchema.safeParse(await request.json())
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }
    payload = result.data
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    )
  }

  const { url, device, width, aspectRatio, delay } = payload
  const isMobile = device === "mobile"
  const isTablet = device === "tablet"
  const hasTouch = isMobile || isTablet
  const params: CaptureParams = {
    url,
    userAgent: isMobile ? MOBILE_UA : isTablet ? TABLET_UA : DESKTOP_UA,
    width,
    height: heightFromAspect(width, aspectRatio),
    isMobile,
    hasTouch,
    extraSettleMs: delayMsFromSetting(delay),
  }
  const cacheKey = screenshotCacheKey(payload)
  const cached = getCachedScreenshot(cacheKey)
  if (cached) {
    return screenshotResponse(cached, "HIT")
  }

  try {
    // The Puppeteer binding (deploy/preview) does the full scroll-through +
    // return-to-top capture. Local `next dev` has no browser binding, so fall
    // back to the Browser Rendering REST API — a lower-fidelity capture (no
    // scroll-through) just so the feature is exercisable without deploying.
    const buffer = binding
      ? await captureViaBinding(binding, params)
      : await captureViaRest(restConfig!, params)
    setCachedScreenshot(cacheKey, buffer)
    return screenshotResponse(buffer, "MISS")
  } catch (err) {
    const status = err instanceof CaptureError ? err.status : 500
    const friendly =
      err instanceof Error && /timeout|timed out/i.test(err.message)
        ? "The site took too long to load. Try a different URL or try again."
        : err instanceof Error
          ? err.message
          : "Capture failed"
    return NextResponse.json({ error: friendly }, { status })
  }
}

function screenshotCacheKey(payload: z.infer<typeof requestSchema>) {
  return JSON.stringify({
    url: payload.url,
    device: payload.device,
    width: payload.width,
    aspectRatio: payload.aspectRatio,
    delay: payload.delay,
    fullPage: true,
  })
}

function getCachedScreenshot(key: string) {
  const entry = screenshotCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    screenshotCache.delete(key)
    return null
  }
  screenshotCache.delete(key)
  screenshotCache.set(key, entry)
  return entry.buffer
}

function setCachedScreenshot(key: string, buffer: ArrayBuffer) {
  screenshotCache.set(key, {
    buffer: buffer.slice(0),
    expiresAt: Date.now() + SCREENSHOT_CACHE_TTL_SECONDS * 1000,
  })

  while (screenshotCache.size > MAX_SCREENSHOT_CACHE_ENTRIES) {
    const oldestKey = screenshotCache.keys().next().value
    if (!oldestKey) break
    screenshotCache.delete(oldestKey)
  }
}

function screenshotResponse(buffer: ArrayBuffer, cacheStatus: "HIT" | "MISS") {
  return new NextResponse(buffer.slice(0), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${SCREENSHOT_CACHE_TTL_SECONDS}, s-maxage=${SCREENSHOT_CACHE_TTL_SECONDS}`,
      "X-Screenshot-Cache": cacheStatus,
    },
  })
}
