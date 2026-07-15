/**
 * GIF encode for the video-media export (gifenc, pure JS): one shared palette
 * built from sampled frames, then a second pass that maps and writes each frame
 * straight into the encoder so only the current frame is ever in memory.
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc"

import type { WatermarkAssets } from "../types"
import { type createProgressReporter, throwIfAborted } from "../utils"
import { blitFrame, type FramePlan, type RenderFrame } from "./frames"

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

export async function encodeGif(
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: RenderFrame,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  signal?: AbortSignal
): Promise<Blob> {
  const w = encodeCanvas.width
  const h = encodeCanvas.height

  // gifenc keeps every compressed frame in one growing in-memory buffer until
  // finish() — nothing streams out. Videos can now be up to 60 min, so a long or
  // high-res clip would silently balloon that buffer (hundreds of MB → tab OOM).
  // Guard on total output volume (frames × area) and fail fast with a clear,
  // actionable message. MP4/WebM stream through the WebCodecs encoder and have
  // no such ceiling, so we point the user there.
  if (gifExportExceedsMemory(plan.frameCount, w, h)) {
    throw new Error(
      "This clip is too long or too large for GIF export. Trim it, lower the resolution, or export as MP4/WebM instead."
    )
  }

  // Pass 1 — build ONE shared 256-color palette (kills frame-to-frame color
  // shimmer) from a handful of evenly-spaced frames. We re-render for these
  // rather than buffering every frame, so memory stays flat regardless of length.
  const sampleCount = Math.min(16, plan.frameCount)
  const sampleData: Uint8ClampedArray[] = []
  let total = 0
  for (let s = 0; s < sampleCount; s++) {
    throwIfAborted(signal)
    const f = Math.floor((s / sampleCount) * plan.frameCount)
    blitFrame(ctx, await renderFrame(f), w, h, watermark)
    const data = ctx.getImageData(0, 0, w, h).data
    sampleData.push(data)
    total += data.length
    progress.report("preparing", s + 1, sampleCount)
  }
  const combined = new Uint8Array(total)
  let offset = 0
  for (const d of sampleData) {
    combined.set(d, offset)
    offset += d.length
  }
  const palette = quantize(combined, 256)
  sampleData.length = 0

  // Pass 2 — re-render each frame, map onto the shared palette, and write it
  // straight into the encoder. Only the current frame is ever in memory.
  const gif = GIFEncoder()
  const delayMs = plan.frameDurationSec * 1000
  let emittedCs = 0
  progress.report("capturing", 0, plan.frameCount)
  for (let f = 0; f < plan.frameCount; f++) {
    throwIfAborted(signal)
    blitFrame(ctx, await renderFrame(f), w, h, watermark)
    const index = applyPalette(ctx.getImageData(0, 0, w, h).data, palette)
    const targetCs = Math.round(((f + 1) * delayMs) / 10)
    const delayCs = Math.max(2, targetCs - emittedCs)
    emittedCs += delayCs
    gif.writeFrame(index, w, h, { palette, delay: delayCs * 10 })
    progress.report("capturing", f + 1, plan.frameCount)
  }
  gif.finish()
  return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" })
}
