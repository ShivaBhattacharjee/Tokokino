// Downscale large images before they reach editor state or get painted to the
// canvas. Two problems we're solving:
//   1. Uploaded images become huge base64 data URLs that bloat the Zustand
//      store and stall IndexedDB persistence.
//   2. Predefined / Unsplash backgrounds load at their native (often 4K+)
//      resolution and re-rasterise with every CSS filter tick, making the
//      editor feel sluggish even though the URL string itself is small.
// Both upload and URL paths funnel through the same shrink+re-encode helper.

import * as React from "react"

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_MAX_RAW_BYTES = 800 * 1024 // 0.8 MB — anything bigger gets re-encoded
const DEFAULT_JPEG_QUALITY = 0.85

export interface DownscaleOptions {
  maxDimension?: number
  maxRawBytes?: number
  jpegQuality?: number
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("FileReader did not return a string"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"))
    reader.readAsDataURL(blob)
  })
}

async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob)
    } catch {
      // fall through to HTMLImageElement
    }
  }
  const dataUrl = await readBlobAsDataUrl(blob)
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image"))
    img.src = dataUrl
  })
}

function loadImageWithCors(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = url
  })
}

function getDims(source: ImageBitmap | HTMLImageElement): {
  width: number
  height: number
} {
  if ("naturalWidth" in source) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

interface DownscaleSourceOptions extends DownscaleOptions {
  isPng?: boolean
}

function downscaleSource(
  source: ImageBitmap | HTMLImageElement,
  { width, height }: { width: number; height: number },
  options: DownscaleSourceOptions
): string | null {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY

  const longest = Math.max(width, height)
  const scale = longest > maxDimension ? maxDimension / longest : 1
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

  const keepPng = options.isPng === true
  const mimeType = keepPng ? "image/png" : "image/jpeg"
  const quality = keepPng ? undefined : jpegQuality
  try {
    return canvas.toDataURL(mimeType, quality)
  } catch {
    // Canvas was tainted (cross-origin without CORS) — caller will fall back.
    return null
  }
}

export async function downscaleImageFile(
  file: File,
  options: DownscaleOptions = {}
): Promise<string> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const maxRawBytes = options.maxRawBytes ?? DEFAULT_MAX_RAW_BYTES

  const source = await decodeBlob(file)
  const dims = getDims(source)
  const longest = Math.max(dims.width, dims.height)
  const needsResize = longest > maxDimension
  const needsReencode = file.size > maxRawBytes

  if (!needsResize && !needsReencode) {
    if ("close" in source) source.close()
    return await readBlobAsDataUrl(file)
  }

  const result = downscaleSource(source, dims, {
    ...options,
    isPng: file.type === "image/png",
  })
  if ("close" in source) source.close()
  return result ?? (await readBlobAsDataUrl(file))
}

// Reads an image file as a data URL, only kicking in the downscale path when
// the file is bigger than `downscaleAbove`. Use this on the screenshot/slot/
// asset upload paths so normal-sized uploads stay pixel-perfect and only
// truly heavy files (e.g. >10 MB phone screenshots) get re-encoded to keep
// the project size sane.
export async function readImageFileAsDataUrl(
  file: File,
  options: {
    downscaleAbove?: number
    maxDimension?: number
    jpegQuality?: number
  } = {}
): Promise<string> {
  const threshold = options.downscaleAbove ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(threshold) || file.size <= threshold) {
    return await readBlobAsDataUrl(file)
  }
  return await downscaleImageFile(file, {
    maxDimension: options.maxDimension ?? 2400,
    // Anything past the size trigger should re-encode unconditionally.
    maxRawBytes: 0,
    jpegQuality: options.jpegQuality ?? 0.9,
  })
}

// Downscale a remote URL by fetching the bytes (or loading via <img crossorigin>
// as a fallback) and re-encoding at the target dimension. If neither path can
// produce a non-tainted canvas, returns the original URL so the caller is
// never worse off than before.
const urlCache = new Map<string, Promise<string>>()
const resolvedUrlCache = new Map<string, string>()
// Cheap-to-render placeholder (typically a CDN thumbnail) used while the
// full downscale is still being fetched/decoded. Keyed by source URL only —
// placeholders don't depend on downscale options.
const placeholderUrlCache = new Map<string, string>()

export function getOptimizedUrlSync(
  url: string,
  options: DownscaleOptions = {}
): string | null {
  if (!url || url.startsWith("data:")) return url || null
  const key = cacheKeyFor(url, options)
  return resolvedUrlCache.get(key) ?? null
}

export function getPlaceholderUrlSync(url: string): string | null {
  if (!url || url.startsWith("data:")) return null
  return placeholderUrlCache.get(url) ?? null
}

export function seedPlaceholderUrl(sourceUrl: string, placeholderUrl: string): void {
  if (!sourceUrl || !placeholderUrl) return
  if (sourceUrl.startsWith("data:") || placeholderUrl.startsWith("data:")) {
    // Pointless to placeholder a data URL with another data URL.
    return
  }
  placeholderUrlCache.set(sourceUrl, placeholderUrl)
}

export function remoteImagePreviewUrl(
  url: string | null | undefined,
  options: DownscaleOptions = {}
): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return null
  try {
    const parsed =
      typeof window === "undefined"
        ? new URL(url)
        : new URL(url, window.location.href)
    if (!["http:", "https:"].includes(parsed.protocol)) return null
    if (
      typeof window !== "undefined" &&
      parsed.origin === window.location.origin &&
      parsed.pathname === "/api/export/image"
    ) {
      return parsed.toString()
    }

    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
    const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY
    const params = new URLSearchParams({
      url: parsed.toString(),
      maxDimension: String(maxDimension),
      quality: String(Math.round(jpegQuality * 100)),
    })
    return `/api/export/image?${params}`
  } catch {
    return null
  }
}

function cacheKeyFor(url: string, options: DownscaleOptions): string {
  const dim = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const q = options.jpegQuality ?? DEFAULT_JPEG_QUALITY
  return `${url}|${dim}|${q}`
}

function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

async function fetchBlobForDownscale(url: string): Promise<Blob | null> {
  // Same-origin requests just hit the URL directly.
  if (isSameOrigin(url)) {
    try {
      const response = await fetch(url, { credentials: "omit" })
      if (response.ok) return await response.blob()
    } catch {
      /* fall through */
    }
    return null
  }

  // Cross-origin reads go straight through the same-origin image proxy. A
  // direct browser fetch would work only if the asset host sends CORS headers,
  // and when it doesn't, Chrome logs noisy blocked-by-CORS errors.
  try {
    const proxied = await fetch(
      `/api/export/image?url=${encodeURIComponent(url)}`,
      { credentials: "omit" }
    )
    if (proxied.ok) return await proxied.blob()
  } catch {
    /* fall through */
  }

  return null
}

export function downscaleImageFromUrl(
  url: string,
  options: DownscaleOptions = {}
): Promise<string> {
  if (!url || url.startsWith("data:")) return Promise.resolve(url)
  const cacheKey = cacheKeyFor(url, options)
  const cached = urlCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    const blob = await fetchBlobForDownscale(url)
    if (blob) {
      try {
        const source = await decodeBlob(blob)
        const dims = getDims(source)
        const result = downscaleSource(source, dims, {
          ...options,
          isPng: blob.type === "image/png",
        })
        if ("close" in source) source.close()
        if (result) {
          resolvedUrlCache.set(cacheKey, result)
          return result
        }
      } catch {
        /* fall through to <img> attempt */
      }
    }

    // Last resort: try a cross-origin <img>. This only succeeds when the
    // origin actually returns CORS headers; otherwise the canvas gets
    // tainted and toDataURL throws, and we return the original URL so the
    // caller is never worse off than before.
    try {
      const img = await loadImageWithCors(url)
      const dims = getDims(img)
      const result = downscaleSource(img, dims, options)
      if (result) {
        resolvedUrlCache.set(cacheKey, result)
        return result
      }
    } catch {
      /* fall through */
    }

    return url
  })()

  urlCache.set(cacheKey, promise)
  promise.catch(() => urlCache.delete(cacheKey))
  return promise
}

// React hook: returns a downscaled version of the given image URL once
// available, falling back to the original URL meanwhile (or as a final
// fallback if optimisation fails). Data URLs are returned as-is — uploaded
// images are already downscaled at intake time.
export function useDownscaledImageUrl(
  src: string | null | undefined,
  options: DownscaleOptions = {}
): string | null {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const jpegQuality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY
  // Stable cache key for the dependency list without re-creating options.
  const optKey = `${maxDimension}|${jpegQuality}`

  const initial = React.useMemo(() => {
    if (!src) return null
    if (src.startsWith("data:")) return src
    const resolved = getOptimizedUrlSync(src, { maxDimension, jpegQuality })
    if (resolved) return resolved
    // Prefer a known thumbnail over the raw heavy URL so the first paint
    // isn't a 4K bitmap.
    return getPlaceholderUrlSync(src) ?? src
  }, [src, maxDimension, jpegQuality])

  const [resolved, setResolved] = React.useState<string | null>(initial)

  React.useEffect(() => {
    if (!src) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolved(null)
      return
    }
    if (src.startsWith("data:")) {
      setResolved(src)
      return
    }
    const cached = getOptimizedUrlSync(src, { maxDimension, jpegQuality })
    if (cached) {
      setResolved(cached)
      return
    }
    const placeholder = getPlaceholderUrlSync(src)
    setResolved(placeholder ?? src)
    let cancelled = false
    downscaleImageFromUrl(src, { maxDimension, jpegQuality })
      .then((next) => {
        if (cancelled) return
        setResolved(next)
      })
      .catch(() => {
        /* keep placeholder/original src */
      })
    return () => {
      cancelled = true
    }
    // optKey collapses maxDimension+jpegQuality into one stable string so the
    // effect doesn't re-run when callers pass a freshly-constructed options
    // object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, optKey])

  return resolved
}
