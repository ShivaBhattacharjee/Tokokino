/**
 * Gaussian-ish blur and saturation over raw RGBA, for export passes that
 * cannot use a CSS or canvas filter.
 *
 * `CanvasRenderingContext2D.filter` is still absent in Safari, and
 * `backdrop-filter` does not survive an SVG `foreignObject` raster in any
 * engine — so the glass frost has to be computed here, in pixels, to match what
 * the editor composites live.
 */

/** Three box passes approximate a Gaussian closely enough for a frost. */
const BLUR_PASSES = 3

/**
 * Blur RGBA in place with a separable box blur.
 *
 * `sigma` is the standard deviation, matching CSS `blur(<length>)`. Alpha is
 * premultiplied for the duration so transparent pixels cannot bleed their
 * colour into the result — a canvas with no background is fully transparent,
 * and unpremultiplied blurring would drag black in from it.
 */
export function blurRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number
): void {
  if (width <= 0 || height <= 0 || sigma <= 0) return
  if (data.length < width * height * 4) return
  const radius = Math.max(1, Math.round(sigma))

  const count = width * height
  const src = new Float32Array(count * 4)
  const dst = new Float32Array(count * 4)

  for (let i = 0; i < count; i++) {
    const alpha = data[i * 4 + 3] / 255
    src[i * 4] = data[i * 4] * alpha
    src[i * 4 + 1] = data[i * 4 + 1] * alpha
    src[i * 4 + 2] = data[i * 4 + 2] * alpha
    src[i * 4 + 3] = data[i * 4 + 3]
  }

  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    boxBlurAxis(src, dst, width, height, radius, true)
    boxBlurAxis(dst, src, width, height, radius, false)
  }

  for (let i = 0; i < count; i++) {
    const alpha = src[i * 4 + 3]
    const scale = alpha > 0 ? 255 / alpha : 0
    data[i * 4] = src[i * 4] * scale
    data[i * 4 + 1] = src[i * 4 + 1] * scale
    data[i * 4 + 2] = src[i * 4 + 2] * scale
    data[i * 4 + 3] = alpha
  }
}

/**
 * One box pass along a single axis, using a sliding window so the cost is
 * independent of the radius. Samples past an edge clamp to it.
 */
function boxBlurAxis(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean
): void {
  const length = horizontal ? width : height
  const lines = horizontal ? height : width
  const step = horizontal ? 4 : width * 4
  const lineStep = horizontal ? width * 4 : 4
  const window = radius * 2 + 1

  for (let line = 0; line < lines; line++) {
    const base = line * lineStep
    let r = 0
    let g = 0
    let b = 0
    let a = 0

    for (let i = -radius; i <= radius; i++) {
      const index = base + clampIndex(i, length) * step
      r += src[index]
      g += src[index + 1]
      b += src[index + 2]
      a += src[index + 3]
    }

    for (let i = 0; i < length; i++) {
      const out = base + i * step
      dst[out] = r / window
      dst[out + 1] = g / window
      dst[out + 2] = b / window
      dst[out + 3] = a / window

      const leaving = base + clampIndex(i - radius, length) * step
      const entering = base + clampIndex(i + radius + 1, length) * step
      r += src[entering] - src[leaving]
      g += src[entering + 1] - src[leaving + 1]
      b += src[entering + 2] - src[leaving + 2]
      a += src[entering + 3] - src[leaving + 3]
    }
  }
}

function clampIndex(index: number, length: number): number {
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

/**
 * Saturate RGBA in place, matching the `saturate()` filter's colour matrix.
 * `amount` is a multiplier — 1 leaves the pixels alone, 1.35 is `saturate(135%)`.
 */
export function saturateRgba(data: Uint8ClampedArray, amount: number): void {
  if (amount === 1) return
  const r0 = 0.213 + 0.787 * amount
  const r1 = 0.715 - 0.715 * amount
  const r2 = 0.072 - 0.072 * amount
  const g0 = 0.213 - 0.213 * amount
  const g1 = 0.715 + 0.285 * amount
  const b2 = 0.072 + 0.928 * amount

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    data[i] = r0 * r + r1 * g + r2 * b
    data[i + 1] = g0 * r + g1 * g + r2 * b
    data[i + 2] = g0 * r + r1 * g + b2 * b
  }
}
