/**
 * GIF encode for the video-media export. Same two-pass shared-palette scheme as
 * the Animate-mode GIF path, and the same worker: the main thread only renders
 * frames, everything downstream of `getImageData` runs off-thread.
 */

import {
  GIF_PALETTE_SAMPLE_FRAMES,
  gifExportExceedsMemory,
  MAX_GIF_TOTAL_PIXELS,
} from "../gif-codec"
import type { WatermarkAssets } from "../types"
import {
  type createProgressReporter,
  createUiYielder,
  throwIfAborted,
} from "../utils"
import { createGifEncoderSession } from "../workers/gif-encoder-client"
import { blitFrame, type FramePlan, type RenderFrame } from "./frames"

export { MAX_GIF_TOTAL_PIXELS, gifExportExceedsMemory }

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

  const encoder = await createGifEncoderSession(signal)
  const yieldToUi = createUiYielder()
  const delayMs = plan.frameDurationSec * 1000

  try {
    // Pass 1 — build ONE shared 256-color palette (kills frame-to-frame color
    // shimmer) from a handful of evenly-spaced frames. We re-render for these
    // rather than buffering every frame, so memory stays flat regardless of length.
    const sampleCount = Math.min(GIF_PALETTE_SAMPLE_FRAMES, plan.frameCount)
    for (let s = 0; s < sampleCount; s++) {
      await yieldToUi()
      throwIfAborted(signal)
      // Bias to frameCount - 1 on the last sample so end-state colors are
      // covered, matching the Animate-mode GIF path.
      const f =
        s === sampleCount - 1
          ? plan.frameCount - 1
          : Math.floor((s / sampleCount) * plan.frameCount)
      blitFrame(ctx, await renderFrame(f), w, h, watermark)
      await encoder.addSample(ctx.getImageData(0, 0, w, h).data)
      progress.report("preparing", s + 1, sampleCount)
    }

    throwIfAborted(signal)
    await yieldToUi()
    await encoder.buildPalette()

    // Pass 2 — re-render each frame and hand its pixels over. The buffer is
    // transferred, so only the frames still queued in the worker are held.
    progress.report("capturing", 0, plan.frameCount)
    for (let f = 0; f < plan.frameCount; f++) {
      await yieldToUi()
      throwIfAborted(signal)
      blitFrame(ctx, await renderFrame(f), w, h, watermark)
      await encoder.writeFrame(
        ctx.getImageData(0, 0, w, h).data,
        w,
        h,
        (f + 1) * delayMs
      )
      progress.report("capturing", f + 1, plan.frameCount)
    }

    throwIfAborted(signal)
    const bytes = await encoder.finish()
    return new Blob([bytes], { type: "image/gif" })
  } finally {
    encoder.dispose()
  }
}
