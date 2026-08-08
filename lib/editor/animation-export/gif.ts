/**
 * GIF encode for the Animate-mode export. The main thread only rasterizes
 * frames; the palette build, dithering, palette mapping and gifenc stream run in
 * the encode worker (see `workers/gif-encoder-client.ts`), which both keeps the
 * UI responsive and overlaps encoding with the next frame's capture.
 */

import { captureStableFrame } from "./capture"
import { GIF_PALETTE_SAMPLE_FRAMES, gifExportExceedsMemory } from "./gif-codec"
import type { CaptureCtx } from "./types"
import { createUiYielder, throwIfAborted } from "./utils"
import { drawWatermark } from "./watermark"
import { createGifEncoderSession } from "./workers/gif-encoder-client"

export { MAX_GIF_FPS } from "./gif-codec"

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

  const encoder = await createGifEncoderSession()
  const yieldToUi = createUiYielder()

  try {
    // Pass 1 — build ONE shared 256-color palette (a per-frame palette is what
    // causes frame-to-frame color shimmer) from a handful of evenly spaced frames.
    // Sampling rather than buffering every frame keeps peak memory flat, so the
    // timeline can be arbitrarily long.
    const sampleCount = Math.min(GIF_PALETTE_SAMPLE_FRAMES, frameCount)
    progress.report("preparing", 0, sampleCount)
    let sampled = 0
    for (let s = 0; s < sampleCount; s++) {
      await yieldToUi()
      throwIfAborted(signal)
      // Bias to frameCount - 1 on the last sample so end-state colors are covered.
      const f =
        s === sampleCount - 1
          ? frameCount - 1
          : Math.floor((s / sampleCount) * frameCount)
      const frame = await renderFrame(f)
      if (frame) {
        await encoder.addSample(frame.data)
        sampled++
      }
      progress.report("preparing", s + 1, sampleCount)
    }
    if (sampled === 0) throw new Error("No frames captured for GIF export")

    throwIfAborted(signal)
    await yieldToUi()
    await encoder.buildPalette()

    // Pass 2 — render each frame and hand its pixels to the encoder. The buffer
    // is transferred, so only the frames still in the worker's queue are held.
    let written = 0
    progress.report("capturing", 0, frameCount)
    for (let f = 0; f < frameCount; f++) {
      await yieldToUi()
      throwIfAborted(signal)
      const frame = await renderFrame(f)
      if (frame) {
        await encoder.writeFrame(
          frame.data,
          frame.width,
          frame.height,
          (f + 1) * frameDurationMs
        )
        written++
      }
      progress.report("capturing", f + 1, frameCount)
    }

    if (written === 0) throw new Error("No frames captured for GIF export")

    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    const bytes = await encoder.finish()
    progress.report("encoding", 1, 1)
    return new Blob([bytes], { type: "image/gif" })
  } finally {
    encoder.dispose()
  }
}
