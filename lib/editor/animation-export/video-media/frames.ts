/**
 * Per-frame plumbing shared by the GIF and MP4/WebM encoders: the output frame
 * plan (how many frames and at what times) and blitting a captured frame onto
 * the encode canvas.
 */

import { safeDrawImage } from "../draw-utils"
import type { WatermarkAssets } from "../types"
import { drawWatermark } from "../watermark"

export type FramePlan = {
  frameCount: number
  frameDurationSec: number
  timeForFrame: (i: number) => number
}

/**
 * Frame plan for the export. Count is simply the clip's real length × fps — no
 * arbitrary ceiling, so a 20-minute clip exports all 20 minutes. It's inherently
 * bounded by the video's actual duration (both encoders stream frames, so a high
 * count doesn't blow up memory); the only guard is against a non-finite duration
 * so the loop can't run away. Cadence is a constant 1/fps → smooth, correct speed.
 */
export function planFrames(durationSec: number, fps: number): FramePlan {
  const safeDuration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0
  const frameCount = Math.max(1, Math.round(safeDuration * fps))
  return {
    frameCount,
    frameDurationSec: 1 / fps,
    timeForFrame: (i) => i / fps,
  }
}

/** A rendered frame for output frame `i`, sized to the capture, not the encoder. */
export type RenderFrame = (i: number) => Promise<HTMLCanvasElement>

/** Draw a captured frame canvas into the (even-sized) encode canvas + watermark. */
export function blitFrame(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  width: number,
  height: number,
  watermark: WatermarkAssets | null
) {
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, width, height)
  safeDrawImage(ctx, frame, 0, 0, width, height)
  if (watermark) drawWatermark(ctx, width, height, watermark)
}
