/**
 * Small, dependency-free canvas/DOM helpers shared by the frame renderer.
 * Extracted from frame-renderer.ts to keep that module focused on the
 * compositing pipeline.
 */

/** Wait for an `<img>` to finish decoding a new `src` (or fail open). */
export function setImageSource(
  img: HTMLImageElement,
  url: string
): Promise<void> {
  return new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

/** Resolve after `ms` — used between Safari foreignObject capture retries. */
export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Detached copy so a later capture can't alias the same canvas buffer. */
export function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas")
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context for canvas copy")
  ctx.drawImage(src, 0, 0)
  return out
}

/** Fraction of sampled pixels with meaningful alpha (0–100). */
export function opaquePct(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx || !canvas.width || !canvas.height) return 0
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return 0
  }
  // Stride the buffer — full scans of an 8K frame are needlessly slow here.
  const step = Math.max(1, Math.floor(data.length / 4 / 20000)) * 4
  let seen = 0
  let opaque = 0
  for (let i = 3; i < data.length; i += step) {
    seen++
    if (data[i] > 8) opaque++
  }
  return seen ? (opaque / seen) * 100 : 0
}

/** Fraction of sampled pixels that are not effectively black (0–100). */
export function nonBlackPct(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx || !canvas.width || !canvas.height) return 0
  const width = Math.min(64, canvas.width)
  const height = Math.min(40, canvas.height)
  const sample = document.createElement("canvas")
  sample.width = width
  sample.height = height
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true })
  if (!sampleCtx) return 0
  sampleCtx.drawImage(canvas, 0, 0, width, height)
  const pixels = sampleCtx.getImageData(0, 0, width, height).data
  let nonBlack = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 8 || pixels[i + 1] > 8 || pixels[i + 2] > 8) nonBlack++
  }
  return (nonBlack / (pixels.length / 4)) * 100
}

/**
 * How far this element's shadows reach beyond its border box, in CSS px.
 *
 * Colour functions are stripped first so their commas don't break the
 * per-shadow split and their numbers aren't mistaken for lengths.
 */
export function shadowExtentPx(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  let max = 0
  for (const source of [cs.boxShadow, cs.filter]) {
    if (!source || source === "none") continue
    const cleaned = source.replace(/(rgba?|hsla?|color)\([^)]*\)/g, " ")
    for (const part of cleaned.split(",")) {
      const nums = (part.match(/-?\d+(?:\.\d+)?(?=px)/g) ?? []).map(Number)
      if (nums.length === 0) continue
      const [dx = 0, dy = 0, blur = 0, spread = 0] = nums
      max = Math.max(
        max,
        Math.abs(dx) + Math.abs(dy) + Math.abs(blur) + Math.abs(spread)
      )
    }
  }
  return Math.ceil(max)
}
