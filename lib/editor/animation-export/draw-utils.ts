/**
 * Canvas `drawImage` safety helpers. Safari/Firefox (and flaky html-to-image
 * captures) can hand back a non-canvas / zero-size value that throws in
 * `drawImage`; these guard against that and provide blank-frame fallbacks.
 */

/** Sources `CanvasRenderingContext2D.drawImage` accepts in practice. */
export type DrawImageSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | OffscreenCanvas
  | SVGImageElement

export function isDrawImageSource(value: unknown): value is DrawImageSource {
  if (value == null || typeof value !== "object") return false
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    value instanceof HTMLCanvasElement
  ) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    value instanceof OffscreenCanvas
  ) {
    return value.width > 0 && value.height > 0
  }
  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    value instanceof HTMLImageElement
  ) {
    return value.naturalWidth > 0 && value.naturalHeight > 0
  }
  if (
    typeof HTMLVideoElement !== "undefined" &&
    value instanceof HTMLVideoElement
  ) {
    return value.videoWidth > 0 && value.videoHeight > 0
  }
  if (
    typeof SVGImageElement !== "undefined" &&
    value instanceof SVGImageElement
  ) {
    return true
  }
  return false
}

/**
 * Safe drawImage — Safari/Firefox (and flaky html-to-image captures) can hand
 * back a non-canvas / zero-size value that throws a TypeError in drawImage.
 * Returns false when the source is unusable so callers can skip/retry.
 */
export function safeDrawImage(
  ctx: CanvasRenderingContext2D,
  source: unknown,
  dx = 0,
  dy = 0,
  dw?: number,
  dh?: number
): boolean {
  if (!isDrawImageSource(source)) return false
  try {
    if (dw != null && dh != null) ctx.drawImage(source, dx, dy, dw, dh)
    else ctx.drawImage(source, dx, dy)
    return true
  } catch {
    return false
  }
}

export function blankFrame(width: number, height: number): HTMLCanvasElement {
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, width)
  copy.height = Math.max(1, height)
  const ctx = copy.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, copy.width, copy.height)
  }
  return copy
}

export function snapshotFrame(
  source: unknown,
  fallbackWidth: number,
  fallbackHeight: number
): HTMLCanvasElement {
  if (!isDrawImageSource(source)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  const w =
    "width" in source && typeof source.width === "number" && source.width > 0
      ? source.width
      : fallbackWidth
  const h =
    "height" in source && typeof source.height === "number" && source.height > 0
      ? source.height
      : fallbackHeight
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, w)
  copy.height = Math.max(1, h)
  const ctx = copy.getContext("2d")
  if (!ctx) return blankFrame(fallbackWidth, fallbackHeight)
  if (!safeDrawImage(ctx, source, 0, 0)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  return copy
}
