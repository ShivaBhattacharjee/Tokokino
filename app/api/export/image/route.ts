import { NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_PREVIEW_DIMENSION = 4096
const DEFAULT_PREVIEW_QUALITY = 85
const MAX_REDIRECTS = 5
const IMAGE_FETCH_HEADERS = {
  Accept:
    "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*,*/*;q=0.8",
  "User-Agent": "TokokinoExport/1.0",
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get("url")
  const previewDimension = parsePreviewDimension(
    searchParams.get("maxDimension") ?? searchParams.get("width")
  )
  const previewQuality = parsePreviewQuality(searchParams.get("quality"))

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing image URL" }, { status: 400 })
  }

  let imageUrl: URL
  try {
    imageUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return NextResponse.json(
      { error: "Unsupported image URL protocol" },
      { status: 400 }
    )
  }

  if (isBlockedHost(imageUrl.hostname)) {
    return NextResponse.json({ error: "Blocked image host" }, { status: 400 })
  }

  const response = await fetchImage(imageUrl)

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

  const image = await response.arrayBuffer()
  if (image.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  }

  if (previewDimension && !contentType.toLowerCase().includes("svg")) {
    try {
      const sharp = (await import("sharp")).default
      const preview = await sharp(Buffer.from(image), { failOn: "none" })
        .rotate()
        .resize(previewDimension, previewDimension, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: previewQuality, effort: 4 })
        .toBuffer()

      return new NextResponse(new Uint8Array(preview), {
        headers: {
          "Cache-Control":
            "public, max-age=86400, stale-while-revalidate=604800",
          "Content-Type": "image/webp",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch {
      return NextResponse.json(
        { error: "Image preview failed" },
        { status: 422 }
      )
    }
  }

  return new NextResponse(image, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function parsePreviewDimension(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(MAX_PREVIEW_DIMENSION, Math.max(1, parsed))
}

function parsePreviewQuality(value: string | null): number {
  if (!value) return DEFAULT_PREVIEW_QUALITY
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_PREVIEW_QUALITY
  return Math.min(100, Math.max(1, parsed))
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
  })

  if (![301, 302, 303, 307, 308].includes(response.status)) return response

  const location = response.headers.get("location")
  if (!location) return response

  const nextUrl = new URL(location, url)
  if (
    !["http:", "https:"].includes(nextUrl.protocol) ||
    isBlockedHost(nextUrl.hostname)
  ) {
    return NextResponse.json({ error: "Blocked image redirect" }, { status: 400 })
  }

  return fetchImage(nextUrl, redirectCount + 1)
}
