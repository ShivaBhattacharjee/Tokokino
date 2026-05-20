import Cloudflare, { APIError } from "cloudflare"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { captureUrlSchema } from "@/lib/editor/capture-url"

export const runtime = "edge"

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

function heightFromAspect(
  width: number,
  aspectRatio: (typeof ASPECT_RATIOS)[number]
) {
  const [w, h] = aspectRatio.split(":").map((n) => Number(n))
  return Math.round((width * h) / w)
}

export async function POST(request: Request) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) {
    return NextResponse.json(
      {
        error:
          "Screenshot capture isn't configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
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
  const client = new Cloudflare({ apiToken })

  const baseParams = {
    account_id: accountId,
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
  } satisfies Cloudflare.BrowserRendering.ScreenshotCreateParams

  // Some sites have long-polling / analytics that never let the network go
  // idle. Try the stricter wait first; on timeout, retry with `load`.
  const attempts: Array<{
    waitUntil: "networkidle2" | "load"
    timeout: number
  }> = [
    { waitUntil: "networkidle2", timeout: 60000 },
    { waitUntil: "load", timeout: 60000 },
  ]

  let lastError: APIError | null = null
  for (const gotoOptions of attempts) {
    try {
      const cfResponse = await client.browserRendering.screenshot
        .create({ ...baseParams, gotoOptions })
        .asResponse()
      const buffer = await cfResponse.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      })
    } catch (err) {
      if (!(err instanceof APIError)) throw err
      lastError = err
      if (!isTimeoutError(err)) break
    }
  }

  const friendly = isTimeoutError(lastError)
    ? "The site took too long to load. Try a different URL or try again."
    : (lastError?.message ?? "Capture failed")
  return NextResponse.json(
    { error: friendly },
    { status: lastError?.status ?? 500 }
  )
}

function isTimeoutError(err: APIError | null) {
  if (!err) return false
  const body = err.error as unknown
  if (body?.errors?.some((e: unknown) => e.code === 6002)) return true
  return /timeout/i.test(err.message ?? "")
}
