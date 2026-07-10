/**
 * GIF encode (gifenc, pure JS). Buffers every frame, builds one shared 256-color
 * palette for the whole clip, ordered-dithers, then writes centisecond-accurate
 * delays so playback cadence matches the requested fps.
 */

import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"

import { captureStableFrame } from "./capture"
import type { CaptureCtx } from "./types"
import { throwIfAborted } from "./utils"
import { drawWatermark } from "./watermark"

/** Frames to sample when building the shared palette — enough to cover the
 *  clip's color range without feeding every pixel of every frame to quantize. */
const GIF_PALETTE_SAMPLE_FRAMES = 16

// 8×8 Bayer threshold matrix (values 0–63) for ordered dithering. Ordered
// dithering is deterministic — the same spatial pattern every frame — so it
// smooths the banding a 256-color palette produces on photographic/image
// backgrounds without the temporal flicker that error-diffusion would add.
// prettier-ignore
const BAYER_8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]

/**
 * Pick a dither strength from the palette's own coarseness: the mean distance
 * from each palette color to its nearest neighbor approximates the quantization
 * step, so we dither by a bit less than that. A palette with big gaps (rich
 * image, lots of banding) gets stronger dithering; a tight palette gets almost
 * none, keeping flat UI areas clean.
 */
function paletteDitherAmplitude(palette: Palette): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < palette.length; i++) {
    const a = palette[i]
    let nearest = Infinity
    for (let j = 0; j < palette.length; j++) {
      if (i === j) continue
      const b = palette[j]
      const dr = a[0] - b[0]
      const dg = a[1] - b[1]
      const db = a[2] - b[2]
      const d = dr * dr + dg * dg + db * db
      if (d < nearest) nearest = d
    }
    if (nearest < Infinity) {
      sum += Math.sqrt(nearest)
      count++
    }
  }
  const meanStep = count ? sum / count : 24
  return Math.max(6, Math.min(40, meanStep * 0.75))
}

/**
 * Apply ordered (Bayer) dithering in place before palette mapping. Adds a
 * per-pixel threshold offset so `applyPalette`'s nearest-color pick alternates
 * between neighboring palette entries across a smooth region — the eye blends
 * them back into a gradient instead of seeing hard bands. Uint8ClampedArray
 * rounds/clamps on assignment, so no manual clamping is needed.
 */
function orderedDither(img: ImageData, amplitude: number) {
  const { data, width, height } = img
  for (let y = 0; y < height; y++) {
    const bayerRow = (y & 7) << 3
    for (let x = 0; x < width; x++) {
      const t = (BAYER_8[bayerRow + (x & 7)] / 64 - 0.5) * amplitude
      const p = (y * width + x) << 2
      data[p] = data[p] + t
      data[p + 1] = data[p + 1] + t
      data[p + 2] = data[p + 2] + t
    }
  }
}

/**
 * Build one 256-color palette for the whole clip from a handful of evenly
 * spaced frames, then re-map every frame onto it. A single shared palette is
 * what stops the frame-to-frame color shimmer you get from quantizing each
 * frame independently — and it moves the expensive `quantize` off the per-frame
 * path (run once instead of N times), which is most of the speedup.
 */
function buildGifPalette(frames: ImageData[]): Palette {
  const stride = Math.max(
    1,
    Math.floor(frames.length / GIF_PALETTE_SAMPLE_FRAMES)
  )
  const samples: Uint8ClampedArray[] = []
  for (let i = 0; i < frames.length; i += stride) samples.push(frames[i].data)
  // Always include the last frame so end-state colors are represented.
  const last = frames[frames.length - 1]?.data
  if (last && samples[samples.length - 1] !== last) samples.push(last)

  let total = 0
  for (const s of samples) total += s.length
  const combined = new Uint8Array(total)
  let offset = 0
  for (const s of samples) {
    combined.set(s, offset)
    offset += s.length
  }
  return quantize(combined, 256)
}

export async function encodeGif(ctx: CaptureCtx) {
  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    progress,
    signal,
    watermark,
  } = ctx

  // Pass 1 — capture every frame's pixels. Buffering the frames lets us build a
  // single shared palette (pass 2) instead of one per frame; the WebM path
  // buffers frames the same way, so peak memory is in line with existing exports.
  progress.report("capturing", 0, frameCount)
  const frames: ImageData[] = []
  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    const frameCanvas = await captureStableFrame(
      capture,
      canvas,
      globalAspect,
      clips,
      f * frameDurationMs
    )
    const gctx = frameCanvas.getContext("2d")
    if (!gctx) {
      progress.report("capturing", f + 1, frameCount)
      continue
    }
    if (watermark) {
      drawWatermark(gctx, frameCanvas.width, frameCanvas.height, watermark)
    }
    frames.push(gctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height))
    progress.report("capturing", f + 1, frameCount)
  }

  if (frames.length === 0) throw new Error("No frames captured for GIF export")

  // Pass 2 — one palette for the whole clip, then re-map + write each frame.
  throwIfAborted(signal)
  progress.report("encoding", 0, frames.length)
  const gif = GIFEncoder()
  const palette = buildGifPalette(frames)
  const ditherAmplitude = paletteDitherAmplitude(palette)

  // GIF delays are whole centiseconds (1/100 s). Distribute the target frame
  // duration across frames (Bresenham-style) so the average cadence matches the
  // requested fps with no rounding drift — this is what removes the playback
  // stutter versus naively truncating each delay to centiseconds.
  let emittedCs = 0
  for (let i = 0; i < frames.length; i++) {
    throwIfAborted(signal)
    const frame = frames[i]
    const { width, height } = frame
    // Ordered-dither before mapping to soften 256-color banding on image
    // backgrounds; deterministic, so it doesn't reintroduce frame-to-frame flicker.
    orderedDither(frame, ditherAmplitude)
    const index = applyPalette(frame.data, palette)
    const targetCs = Math.round(((i + 1) * frameDurationMs) / 10)
    // Never below 2cs — most viewers clamp shorter delays to ~10cs, which would
    // itself look like a stutter.
    const delayCs = Math.max(2, targetCs - emittedCs)
    emittedCs += delayCs
    gif.writeFrame(index, width, height, { palette, delay: delayCs * 10 })
    progress.report("encoding", i + 1, frames.length)
  }

  throwIfAborted(signal)
  gif.finish()
  progress.report("encoding", frames.length, frames.length)
  return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" })
}
