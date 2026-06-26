import { NextResponse } from "next/server"

import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"
import { proxyImageUrlSchema } from "@/lib/schemas/image-proxy"

export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_REDIRECTS = 5
const IMAGE_FETCH_TIMEOUT_MS = 12_000
const IMAGE_FETCH_HEADERS = {
  Accept:
    "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,*/*;q=0.8",
  "User-Agent": "TokokinoExport/1.0",
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit({
    limiter: "HEAVY_RATE_LIMITER",
    scope: "export-image",
    id: getClientIp(request.headers),
  })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const parsedUrl = proxyImageUrlSchema.safeParse(searchParams.get("url") ?? "")
  if (!parsedUrl.success) {
    return NextResponse.json(
      { error: parsedUrl.error.issues[0]?.message ?? "Invalid image URL" },
      { status: 400 }
    )
  }
  const imageUrl = parsedUrl.data

  if (isBlockedHost(imageUrl.hostname)) {
    return NextResponse.json({ error: "Blocked image host" }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetchImage(imageUrl)
  } catch (error) {
    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "Image fetch timed out" },
        { status: 504 }
      )
    }
    throw error
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Image fetch failed" },
      { status: response.status }
    )
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json(
      { error: "URL did not return an image" },
      { status: 415 }
    )
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0")
  if (contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  }

  let image: ArrayBuffer
  try {
    image = await response.arrayBuffer()
  } catch (error) {
    if (isTimeoutError(error)) {
      return NextResponse.json(
        { error: "Image fetch timed out" },
        { status: 504 }
      )
    }
    throw error
  }
  if (image.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  }

  return new NextResponse(image, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return true
  if (host.includes(":")) return true

  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!ipv4) return false

  const [a, b] = ipv4.slice(1).map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

async function fetchImage(url: URL, redirectCount = 0): Promise<Response> {
  if (redirectCount > MAX_REDIRECTS) {
    return NextResponse.json({ error: "Too many redirects" }, { status: 508 })
  }

  const response = await fetch(url, {
    headers: IMAGE_FETCH_HEADERS,
    redirect: "manual",
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  })

  if (![301, 302, 303, 307, 308].includes(response.status)) return response

  const location = response.headers.get("location")
  if (!location) return response

  const nextUrl = new URL(location, url)
  if (
    !["http:", "https:"].includes(nextUrl.protocol) ||
    isBlockedHost(nextUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "Blocked image redirect" },
      { status: 400 }
    )
  }

  return fetchImage(nextUrl, redirectCount + 1)
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error || error instanceof DOMException)) return false
  return error.name === "TimeoutError" || error.name === "AbortError"
}
