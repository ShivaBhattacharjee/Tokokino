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

/** Bounded alpha sample used by Safari foreground retries. */
export function alphaSample(canvas: HTMLCanvasElement): {
  opaquePct: number
  signature: number
} {
  if (!canvas.width || !canvas.height) {
    return { opaquePct: 0, signature: 0 }
  }
  const width = Math.min(128, canvas.width)
  const height = Math.min(80, canvas.height)
  const sample = document.createElement("canvas")
  sample.width = width
  sample.height = height
  const ctx = sample.getContext("2d", { willReadFrequently: true })
  if (!ctx) return { opaquePct: 0, signature: 0 }
  ctx.drawImage(canvas, 0, 0, width, height)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, width, height).data
  } catch {
    return { opaquePct: 0, signature: 0 }
  }
  let opaque = 0
  let signature = 2166136261
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha > 0) opaque++
    signature = Math.imul(signature ^ data[i], 16777619)
    signature = Math.imul(signature ^ data[i + 1], 16777619)
    signature = Math.imul(signature ^ data[i + 2], 16777619)
    signature = Math.imul(signature ^ alpha, 16777619)
  }
  return {
    opaquePct: (opaque / (data.length / 4)) * 100,
    signature: signature >>> 0,
  }
}

/** Fraction of sampled pixels with meaningful alpha (0–100). */
export function opaquePct(canvas: HTMLCanvasElement): number {
  return alphaSample(canvas).opaquePct
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
 * How far this element's decoration reaches beyond its border box, in CSS px.
 *
 * This is the margin a projected texture has to bake around the box, so it must
 * cover everything that paints outside it and is therefore invisible to
 * `getBoundingClientRect()`.
 *
 * Shadows: colour functions are stripped first so their commas don't break the
 * per-shadow split and their numbers aren't mistaken for lengths.
 *
 * Outline: the screenshot's "border" is an `outline` sitting `outline-offset`
 * clear of the edge (see `buildScreenshotImageStyle`), not a CSS border. Layout
 * ignores it entirely, so leaving it out of the padding cropped the border off
 * the texture — the video then ran to the very edge of the plate instead of
 * sitting inside it.
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

  const outlineWidth = parseFloat(cs.outlineWidth) || 0
  if (cs.outlineStyle && cs.outlineStyle !== "none" && outlineWidth > 0) {
    // A negative offset pulls the outline inward, where it needs no margin.
    const outlineOffset = Math.max(0, parseFloat(cs.outlineOffset) || 0)
    max = Math.max(max, outlineWidth + outlineOffset)
  }

  return Math.ceil(max)
}
