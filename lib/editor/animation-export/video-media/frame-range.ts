/**
 * Limited→full range repair for WebCodecs-decoded frames.
 *
 * Studio-swing video carries luma in 16–235, and whoever converts it to RGB is
 * supposed to stretch that back to 0–255. WebKit's `VideoFrame` → canvas
 * conversion does not: a probe of the same clip in one Safari run measured a
 * black floor of 15 and a white ceiling of 234 from the decoded path, against 0
 * from the very same file drawn through a native `<video>`. Blacks sitting at
 * 16/255 grey with the highlights pulled down to 235 is exactly the "washed out"
 * export — and it is the decoded path only, which is why Chromium (which
 * rasterizes the `<video>` itself) was always fine.
 *
 * The repair is the stretch that was skipped. It is applied at the decode source
 * so every consumer — the plain video export and the Animate keyframe export
 * alike — gets corrected frames without knowing about any of this.
 */

/** Studio-swing luma bounds, the range the decoder left the pixels in. */
const LIMITED_BLACK = 16
const LIMITED_WHITE = 235
const LIMITED_SPAN = LIMITED_WHITE - LIMITED_BLACK

/**
 * A decoded frame is judged limited-range by comparing it against the browser's
 * OWN conversion of the same picture, so the test is about the conversion rather
 * than the content — a dark clip does not read as limited-range, and a correct
 * engine is never "corrected".
 *
 * The margin is wide: a genuine mismatch moves the floor by ~16 levels, while
 * two correct conversions of one frame differ only by resampling noise.
 */
const BLACK_FLOOR_MARGIN = 8

export type FrameLevels = { black: number; white: number }

/** Mediabunny yields either kind depending on the engine. Both read the same. */
export type FrameCanvas = HTMLCanvasElement | OffscreenCanvas

/** The 2D context of either canvas kind, narrowed to what this module uses. */
type Ctx2d = Pick<CanvasRenderingContext2D, "getImageData" | "putImageData">

function context2d(canvas: FrameCanvas): Ctx2d | null {
  return canvas.getContext("2d", { willReadFrequently: true })
}

/** Luma floor and ceiling over a sample of opaque pixels, or null if none. */
export function canvasLevels(canvas: FrameCanvas): FrameLevels | null {
  try {
    const ctx = context2d(canvas)
    if (!ctx || !canvas.width || !canvas.height) return null
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let black = 255
    let white = 0
    let seen = false
    // Every 13th pixel: the extremes of a photographic frame survive this, and
    // it keeps the setup probe off the critical path at 1080p.
    for (let i = 0; i < data.length; i += 4 * 13) {
      if (data[i + 3] < 250) continue
      const luma =
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (luma < black) black = luma
      if (luma > white) white = luma
      seen = true
    }
    return seen ? { black, white } : null
  } catch {
    return null
  }
}

/** Narrow a decoded frame to the canvas kinds this module can measure. */
export function isFrameCanvas(frame: unknown): frame is FrameCanvas {
  return (
    (typeof HTMLCanvasElement !== "undefined" &&
      frame instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== "undefined" && frame instanceof OffscreenCanvas)
  )
}

/** Draw `video`'s current frame small, via the engine's own conversion. */
export function drawVideoReference(
  video: HTMLVideoElement
): HTMLCanvasElement | null {
  try {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const canvas = document.createElement("canvas")
    canvas.width = Math.min(480, w)
    canvas.height = Math.max(1, Math.round((canvas.width * h) / w))
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch {
    return null
  }
}

/**
 * True when `decoded` sits in studio swing while `reference` — the same picture
 * through the engine's native path — does not.
 *
 * Undecidable cases return false: correcting on a guess would crush the blacks
 * of every engine that already converts properly.
 */
export function decodedNeedsRangeExpansion(
  decoded: FrameCanvas,
  reference: FrameCanvas
): boolean {
  const d = canvasLevels(decoded)
  const r = canvasLevels(reference)
  if (!d || !r) return false
  // The decoded floor has to actually sit at studio black, not merely above the
  // reference — a frame whose darkest pixel is legitimately mid-grey must not
  // qualify however the two compare.
  const atStudioBlack =
    d.black >= LIMITED_BLACK - 4 && d.black <= LIMITED_BLACK + 4
  return atStudioBlack && d.black - r.black >= BLACK_FLOOR_MARGIN
}

/**
 * Stretch 16–235 back to 0–255, in place. Per-channel and affine, which is the
 * correct inverse when the decoder applied the YUV→RGB matrix but skipped the
 * range scaling — the omission is the same on all three channels.
 */
export function expandLimitedRange(canvas: FrameCanvas): void {
  try {
    const ctx = context2d(canvas)
    if (!ctx || !canvas.width || !canvas.height) return
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = image
    const scale = 255 / LIMITED_SPAN
    const offset = -LIMITED_BLACK * scale
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] * scale + offset
      data[i + 1] = data[i + 1] * scale + offset
      data[i + 2] = data[i + 2] * scale + offset
    }
    ctx.putImageData(image, 0, 0)
  } catch {
    // A tainted canvas can't be repaired; leave the frame as decoded.
  }
}
