/**
 * GIF encoding maths, with no DOM in sight — one shared 256-color palette built
 * from sampled frames, ordered dithering, and streaming frame writes.
 *
 * Deliberately free of any browser-only API so the exact same code runs in the
 * encode worker (`workers/gif-encoder.worker.ts`) and in the main-thread
 * fallback used when workers are unavailable.
 */

import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"

/** Frames to sample when building the shared palette — enough to cover the
 *  clip's color range without feeding every pixel of every frame to quantize. */
export const GIF_PALETTE_SAMPLE_FRAMES = 16

/**
 * Fastest cadence a GIF can actually express. Delays are whole centiseconds and
 * viewers clamp anything under 2cs to ~10cs, so 2cs (50fps) is the floor per
 * frame. Asking for more doesn't play faster — the encoder still emits 2cs and
 * the clip runs long (60fps would stretch it by 20%). Callers clamp to this.
 */
export const MAX_GIF_FPS = 50

// Cap on GIF output volume = frames × pixels-per-frame. gifenc buffers the
// whole compressed stream in memory, so this bounds peak usage regardless of
// clip length or resolution. ~350M keeps the buffer comfortably under ~300 MB
// even for poorly-compressing footage, while still allowing ~20 s at 1080p or
// much longer at smaller sizes.
export const MAX_GIF_TOTAL_PIXELS = 350_000_000

/**
 * True when a GIF export of this many frames at this size would risk exhausting
 * memory (gifenc holds the entire compressed stream in RAM until finish()).
 * Callers should fail fast with a clear message rather than crash the tab.
 */
export function gifExportExceedsMemory(
  frameCount: number,
  width: number,
  height: number
): boolean {
  return frameCount * width * height > MAX_GIF_TOTAL_PIXELS
}

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
export function paletteDitherAmplitude(palette: Palette): number {
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
export function orderedDither(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amplitude: number
) {
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
 * Two-pass GIF encoder: collect palette samples, build the shared palette, then
 * stream frames through it. Only the current frame is ever held, so timeline
 * length is bounded by {@link gifExportExceedsMemory} rather than by RAM.
 *
 * GIF delays are whole centiseconds (1/100 s), so the target frame duration is
 * distributed across frames Bresenham-style: the average cadence matches the
 * requested fps with no rounding drift, which is what removes the playback
 * stutter versus naively truncating each delay.
 */
export class GifStreamEncoder {
  private readonly samples: Uint8ClampedArray[] = []
  private sampleBytes = 0
  private palette: Palette | null = null
  private ditherAmplitude = 0
  private readonly gif = GIFEncoder()
  private emittedCs = 0
  private written = 0

  addSample(data: Uint8ClampedArray) {
    this.samples.push(data)
    this.sampleBytes += data.length
  }

  get sampleCount() {
    return this.samples.length
  }

  /** Quantize the collected samples into one palette. The heavy call. */
  buildPalette() {
    if (this.sampleBytes === 0) {
      throw new Error("No frames captured for GIF export")
    }
    const combined = new Uint8Array(this.sampleBytes)
    let offset = 0
    // Drop each sample as it is copied rather than after the loop: both copies
    // are live until then, and 16 sampled 1080p frames is ~130 MB per copy —
    // right before quantize() wants a working set of its own.
    for (
      let sample = this.samples.shift();
      sample;
      sample = this.samples.shift()
    ) {
      combined.set(sample, offset)
      offset += sample.length
    }
    this.sampleBytes = 0
    this.palette = quantize(combined, 256)
    this.ditherAmplitude = paletteDitherAmplitude(this.palette)
  }

  /**
   * Dither, map onto the shared palette, and write one frame. `elapsedMs` is the
   * frame's end time on the timeline, from which the centisecond delay for this
   * frame is derived.
   */
  writeFrame(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    elapsedMs: number
  ) {
    const palette = this.palette
    if (!palette) throw new Error("GIF palette has not been built")
    orderedDither(data, width, height, this.ditherAmplitude)
    const index = applyPalette(data, palette)
    const targetCs = Math.round(elapsedMs / 10)
    // Never below 2cs — most viewers clamp shorter delays to ~10cs, which would
    // itself look like a stutter.
    const delayCs = Math.max(2, targetCs - this.emittedCs)
    this.emittedCs += delayCs
    this.gif.writeFrame(index, width, height, {
      palette,
      delay: delayCs * 10,
    })
    this.written++
  }

  get frameCount() {
    return this.written
  }

  finish(): Uint8Array<ArrayBuffer> {
    if (this.written === 0) {
      throw new Error("No frames captured for GIF export")
    }
    this.gif.finish()
    // Copies out of gifenc's internal buffer, so the result owns its bytes and
    // can be transferred back across the worker boundary.
    const view = this.gif.bytesView()
    const bytes = new Uint8Array(new ArrayBuffer(view.byteLength))
    bytes.set(view)
    return bytes
  }
}
