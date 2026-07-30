/**
 * GIF encode (gifenc, pure JS). Builds one shared 256-color palette for the whole
 * clip from sampled frames, then ordered-dithers and writes each frame straight
 * into the encoder with centisecond-accurate delays so playback cadence matches
 * the requested fps.
 */

import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"

import { captureStableFrame } from "./capture"
import type { CaptureCtx } from "./types"
import { throwIfAborted } from "./utils"
import { gifExportExceedsMemory } from "./video-media/encode-gif"
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
    videoLayer,
  } = ctx

  // gifenc accumulates the whole compressed stream in one in-memory buffer until
  // finish(), so bound the output by frames × area and fail fast with an
  // actionable message. MP4/WebM stream through WebCodecs and have no ceiling.
  if (gifExportExceedsMemory(frameCount, capture.width, capture.height)) {
    throw new Error(
      "This animation is too long or too large for GIF export. Shorten the timeline, lower the resolution, or export as MP4/WebM instead."
    )
  }

  const renderFrame = async (f: number) => {
    const frameCanvas = await captureStableFrame(
      capture,
      canvas,
      globalAspect,
      clips,
      f * frameDurationMs,
      videoLayer
    )
    const gctx = frameCanvas.getContext("2d")
    if (!gctx) return null
    if (watermark) {
      drawWatermark(gctx, frameCanvas.width, frameCanvas.height, watermark)
    }
    return gctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
  }

  // Pass 1 — build ONE shared 256-color palette (a per-frame palette is what
  // causes frame-to-frame color shimmer) from a handful of evenly spaced frames.
  // Sampling rather than buffering every frame keeps peak memory flat, so the
  // timeline can be arbitrarily long.
  const sampleCount = Math.min(GIF_PALETTE_SAMPLE_FRAMES, frameCount)
  progress.report("preparing", 0, sampleCount)
  const sampleData: Uint8ClampedArray[] = []
  let total = 0
  for (let s = 0; s < sampleCount; s++) {
    throwIfAborted(signal)
    // Bias to frameCount - 1 on the last sample so end-state colors are covered.
    const f =
      s === sampleCount - 1
        ? frameCount - 1
        : Math.floor((s / sampleCount) * frameCount)
    const frame = await renderFrame(f)
    if (frame) {
      sampleData.push(frame.data)
      total += frame.data.length
    }
    progress.report("preparing", s + 1, sampleCount)
  }
  if (total === 0) throw new Error("No frames captured for GIF export")

  const combined = new Uint8Array(total)
  let offset = 0
  for (const d of sampleData) {
    combined.set(d, offset)
    offset += d.length
  }
  sampleData.length = 0
  const palette: Palette = quantize(combined, 256)
  const ditherAmplitude = paletteDitherAmplitude(palette)

  // Pass 2 — render each frame, map onto the shared palette, write it straight
  // into the encoder. Only the current frame is ever held in memory.
  //
  // GIF delays are whole centiseconds (1/100 s). Distribute the target frame
  // duration across frames (Bresenham-style) so the average cadence matches the
  // requested fps with no rounding drift — this is what removes the playback
  // stutter versus naively truncating each delay to centiseconds.
  const gif = GIFEncoder()
  let emittedCs = 0
  let written = 0
  progress.report("capturing", 0, frameCount)
  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    const frame = await renderFrame(f)
    if (!frame) {
      progress.report("capturing", f + 1, frameCount)
      continue
    }
    // Ordered-dither before mapping to soften 256-color banding on image
    // backgrounds; deterministic, so it doesn't reintroduce frame-to-frame flicker.
    orderedDither(frame, ditherAmplitude)
    const index = applyPalette(frame.data, palette)
    const targetCs = Math.round(((f + 1) * frameDurationMs) / 10)
    // Never below 2cs — most viewers clamp shorter delays to ~10cs, which would
    // itself look like a stutter.
    const delayCs = Math.max(2, targetCs - emittedCs)
    emittedCs += delayCs
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: delayCs * 10,
    })
    written++
    progress.report("capturing", f + 1, frameCount)
  }

  if (written === 0) throw new Error("No frames captured for GIF export")

  throwIfAborted(signal)
  progress.report("encoding", 0, 1)
  gif.finish()
  progress.report("encoding", 1, 1)
  return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" })
}
