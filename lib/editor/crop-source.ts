// Loading and rendering for the crop dialog.
//
// The dialog used to turn whatever it was given into a `File` and hand that to
// the cropper, which read it back out as a base64 data URL. On a 20 MB
// full-page screenshot that meant a synchronous `atob` plus a byte-at-a-time
// copy on the main thread, then a second full base64 encode, then a full-res
// decode into an <img> — several hundred MB of peak allocation and seconds of
// jank before the dialog could paint. Remote screenshots didn't get that far at
// all: they were fetched cross-origin without the proxy and died on CORS.
//
// Here the source is fetched once as a blob, previewed through an object URL
// (downscaled when the image is huge), and the applied crop is rendered from
// the original bytes so output resolution never depends on the preview.

import type { CropRegion } from "./state-types"

import { fetchImageBlob } from "./image-resize"

/**
 * Longest side of the preview the crop handles are drawn over. The cropper box
 * is ~420 px tall, so anything past this is invisible detail that costs a
 * full-resolution bitmap in the DOM for as long as the dialog is open.
 */
const MAX_PREVIEW_DIMENSION = 2200

/**
 * Ceiling on the rendered crop, in pixels. Safari rejects canvases past ~2^24
 * pixels and silently returns a blank bitmap, so clamp to that common floor
 * rather than Chrome's higher limit.
 */
const MAX_OUTPUT_PIXELS = 16_777_216

export type CropSource = {
  /** URL for the <img> the crop handles are drawn over — possibly downscaled. */
  previewUrl: string
  /** Original bytes. The applied crop is rendered from these, at full size. */
  blob: Blob
  /** Intrinsic size of the ORIGINAL, not of the preview. */
  width: number
  height: number
  /** Revokes the object URLs. Safe to call twice. */
  release: () => void
}

function isDataOrBlobUrl(url: string) {
  return url.startsWith("data:") || url.startsWith("blob:")
}

/**
 * Bytes for any screenshot URL the editor can hold. `fetch` handles data: and
 * blob: URLs natively and off the main thread, which is what keeps a 20 MB
 * base64 screenshot from freezing the tab — decoding it in JS does not.
 */
export async function loadImageBlob(url: string): Promise<Blob> {
  if (isDataOrBlobUrl(url)) {
    const response = await fetch(url)
    return await response.blob()
  }
  const blob = await fetchImageBlob(url)
  if (!blob) throw new Error("Could not load image")
  return blob
}

type DecodedSize = { width: number; height: number }

/**
 * Intrinsic size of the source. An <img> gets there off the header without
 * committing to a full raster decode, so it is tried before `createImageBitmap`
 * — which always decodes everything, and on a tall scrolling capture that is
 * hundreds of megabytes we would immediately throw away.
 */
async function decodeSize(blob: Blob, url: string): Promise<DecodedSize> {
  try {
    const img = await loadImageElement(url)
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight }
    }
  } catch {
    // fall through to createImageBitmap
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("Could not decode image")
  }
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image"))
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/png"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type
    )
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"))
    reader.readAsDataURL(blob)
  })
}

/**
 * A preview no larger than {@link MAX_PREVIEW_DIMENSION}, or null when the
 * original is already small enough (or the browser can't resize it for us).
 * `createImageBitmap` does the decode and the resize off the main thread.
 */
async function buildPreviewUrl(
  blob: Blob,
  { width, height }: DecodedSize
): Promise<string | null> {
  const longest = Math.max(width, height)
  if (longest <= MAX_PREVIEW_DIMENSION) return null
  if (typeof createImageBitmap !== "function") return null

  const scale = MAX_PREVIEW_DIMENSION / longest
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: targetW,
      resizeHeight: targetH,
      resizeQuality: "medium",
    })
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    // Preview-only: WebP is much smaller than PNG for the same bitmap and is
    // never re-encoded into the applied crop.
    const previewBlob = await canvasToBlob(canvas, "image/webp")
    // Free the backing store now rather than waiting on GC; the preview can be
    // tens of megabytes of decoded pixels.
    canvas.width = 0
    canvas.height = 0
    return URL.createObjectURL(previewBlob)
  } catch {
    return null
  }
}

/**
 * Prepare a screenshot URL for the crop dialog: fetch it once, measure it, and
 * hand back a cheap preview plus the original bytes.
 */
export async function createCropSource(url: string): Promise<CropSource> {
  return await cropSourceFromBlob(await loadImageBlob(url))
}

/** Same as {@link createCropSource} for bytes already in hand (a video poster). */
export async function cropSourceFromBlob(blob: Blob): Promise<CropSource> {
  const blobUrl = URL.createObjectURL(blob)
  let previewUrl: string | null = null

  try {
    const size = await decodeSize(blob, blobUrl)
    previewUrl = await buildPreviewUrl(blob, size)
    let released = false
    return {
      previewUrl: previewUrl ?? blobUrl,
      blob,
      width: size.width,
      height: size.height,
      release: () => {
        if (released) return
        released = true
        URL.revokeObjectURL(blobUrl)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
      },
    }
  } catch (error) {
    URL.revokeObjectURL(blobUrl)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    throw error
  }
}

/** Region in percent → integer source-pixel rect, clamped inside the image. */
function regionToPixels(
  region: CropRegion,
  width: number,
  height: number
): { sx: number; sy: number; sw: number; sh: number } | null {
  const sx = Math.round(Math.max(0, Math.min(100, region.x)) * width * 0.01)
  const sy = Math.round(Math.max(0, Math.min(100, region.y)) * height * 0.01)
  const sw = Math.round(Math.max(0, region.width) * width * 0.01)
  const sh = Math.round(Math.max(0, region.height) * height * 0.01)
  const clampedW = Math.min(sw, width - sx)
  const clampedH = Math.min(sh, height - sy)
  if (clampedW < 1 || clampedH < 1) return null
  return { sx, sy, sw: clampedW, sh: clampedH }
}

/** Output size for a crop rect, shrunk only if it would exceed the pixel cap. */
function outputSize(sw: number, sh: number) {
  const pixels = sw * sh
  if (pixels <= MAX_OUTPUT_PIXELS)
    return { width: sw, height: sh, scaled: false }
  const scale = Math.sqrt(MAX_OUTPUT_PIXELS / pixels)
  return {
    width: Math.max(1, Math.floor(sw * scale)),
    height: Math.max(1, Math.floor(sh * scale)),
    scaled: true,
  }
}

/**
 * Render a percent crop of the source at full resolution and return it as a PNG
 * data URL. Percent regions are resolution-independent, so the preview the user
 * dragged the handles over can be a downscaled stand-in without affecting this.
 */
export async function renderCroppedImage(
  source: Pick<CropSource, "blob" | "width" | "height">,
  region: CropRegion
): Promise<string | null> {
  const rect = regionToPixels(region, source.width, source.height)
  if (!rect) return null

  const { width, height, scaled } = outputSize(rect.sw, rect.sh)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  // A 1:1 copy wants no resampling at all; a capped crop is being shrunk and
  // needs it.
  ctx.imageSmoothingEnabled = scaled
  if (scaled) ctx.imageSmoothingQuality = "high"

  let drawn = false
  if (typeof createImageBitmap === "function") {
    try {
      // Cropping during decode: the browser never materialises the full-size
      // bitmap on our side, which is the difference between a working crop and
      // an out-of-memory tab on a tall scrolling capture.
      const bitmap = await createImageBitmap(
        source.blob,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh
      )
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      drawn = true
    } catch {
      // fall through to <img>
    }
  }

  if (!drawn) {
    const url = URL.createObjectURL(source.blob)
    try {
      const img = await loadImageElement(url)
      ctx.drawImage(
        img,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        0,
        0,
        width,
        height
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const blob = await canvasToBlob(canvas)
  canvas.width = 0
  canvas.height = 0
  return await blobToDataUrl(blob)
}

export const __testing = {
  MAX_OUTPUT_PIXELS,
  MAX_PREVIEW_DIMENSION,
  outputSize,
  regionToPixels,
}
