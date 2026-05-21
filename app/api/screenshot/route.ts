import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { captureUrlSchema } from "@/lib/editor/capture-url"
import { env } from "@/lib/env"

const ASPECT_RATIOS = ["4:3", "16:9", "1:1", "9:16", "9:19.5"] as const

const requestSchema = z.object({
  url: captureUrlSchema,
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  width: z.number().int().min(320).max(3840),
  aspectRatio: z.enum(ASPECT_RATIOS),
})

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const SCREENSHOT_CACHE_TTL_SECONDS = 300
const MAX_SCREENSHOT_CACHE_ENTRIES = 30
const SCREENSHOT_REQUEST_TIMEOUT_MS = 35000
const SCREENSHOT_NAVIGATION_TIMEOUT_MS = 30000

type ScreenshotCacheEntry = {
  buffer: ArrayBuffer
  expiresAt: number
}

type CloudflareApiErrorBody = {
  errors?: Array<{
    code?: number
    message?: string
  }>
}

const screenshotCache = new Map<string, ScreenshotCacheEntry>()

function heightFromAspect(
  width: number,
  aspectRatio: (typeof ASPECT_RATIOS)[number]
) {
  const [w, h] = aspectRatio.split(":").map((n) => Number(n))
  return Math.round((width * h) / w)
}

export async function POST(request: Request) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_BROWSER_API_TOKEN
  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error:
          "Screenshot capture isn't configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_BROWSER_API_TOKEN.",
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

  const { url, device, width, aspectRatio } = payload
  const isMobile = device === "mobile"
  const cacheKey = screenshotCacheKey(payload)
  const cached = getCachedScreenshot(cacheKey)
  if (cached) {
    return screenshotResponse(cached, "HIT")
  }

  const screenshotParams = {
    cacheTTL: SCREENSHOT_CACHE_TTL_SECONDS,
    url,
    viewport: {
      width,
      height: heightFromAspect(width, aspectRatio),
      deviceScaleFactor: 2,
      isMobile,
      hasTouch: isMobile,
    },
    userAgent: isMobile ? MOBILE_UA : DESKTOP_UA,
    screenshotOptions: { type: "png", captureBeyondViewport: false },
    gotoOptions: {
      waitUntil: "load",
      timeout: SCREENSHOT_NAVIGATION_TIMEOUT_MS,
    },
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`

  try {
    const cfResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "image/png",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(screenshotParams),
      signal: AbortSignal.timeout(SCREENSHOT_REQUEST_TIMEOUT_MS),
    })

    if (!cfResponse.ok) {
      const errorBody = await parseCloudflareErrorBody(cfResponse)
      const friendly = screenshotErrorMessage(errorBody, cfResponse.statusText)
      return NextResponse.json({ error: friendly }, { status: cfResponse.status })
    }

    const buffer = await cfResponse.arrayBuffer()
    setCachedScreenshot(cacheKey, buffer)
    return screenshotResponse(buffer, "MISS")
  } catch (err) {
    const friendly =
      err instanceof DOMException && err.name === "TimeoutError"
        ? "The site took too long to load. Try a different URL or try again."
        : err instanceof Error
          ? err.message
          : "Capture failed"
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}

function screenshotCacheKey(payload: z.infer<typeof requestSchema>) {
  return JSON.stringify({
    url: payload.url,
    device: payload.device,
    width: payload.width,
    aspectRatio: payload.aspectRatio,
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

async function parseCloudflareErrorBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return null
  return (await response.json().catch(() => null)) as CloudflareApiErrorBody | null
}

function screenshotErrorMessage(
  body: CloudflareApiErrorBody | null,
  fallback: string
) {
  if (hasCloudflareErrorCode(body, 6002)) {
    return "The site took too long to load. Try a different URL or try again."
  }

  const message = body?.errors?.find((error) => error.message)?.message
  return message ?? fallback ?? "Capture failed"
}

function hasCloudflareErrorCode(body: CloudflareApiErrorBody | null, code: number) {
  if (!body || typeof body !== "object") return false
  return body.errors?.some((entry) => entry.code === code) ?? false
}
