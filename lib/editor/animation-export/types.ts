/**
 * Shared types and constants for the local animation-export pipeline.
 */

import type { AnimationCapture } from "../export"
import type { AnimationClip, CanvasState } from "../state-types"
import type { ProgressReporter } from "./utils"

export type AnimationExportFormat = "webm" | "mp4" | "gif"

export type AnimationExportPhase =
  | "preparing"
  | "capturing"
  | "encoding"
  | "finishing"

export type AnimationExportProgress = {
  phase: AnimationExportPhase
  current: number
  total: number
  etaMs: number | null
}

/**
 * Frame-capture strategy.
 *  - `fast`   — reused-clone `<foreignObject>` path. Sets up the clone/assets once
 *               and bakes computed styles per frame (no re-clone, no re-embed, no
 *               paint wait). Faster; correct for every canvas.
 *  - `legacy` — html-to-image path (exposed as "Precise"). Fully re-processes the
 *               DOM each frame. Slower, kept as a fallback.
 *  - `auto`   — fast, falling back to legacy only if fast setup throws. Default.
 */
export type AnimationCaptureMode = "auto" | "fast" | "legacy"

export type AnimationExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
  /** Draw the "Designed by Tokokino" watermark on every frame. Defaults to on. */
  watermark?: boolean
  /** Frame-capture strategy. Defaults to `auto`. */
  capture?: AnimationCaptureMode
  onProgress?: (progress: AnimationExportProgress) => void
  signal?: AbortSignal
  /**
   * When true, return the encoded blob instead of downloading it.
   * Used by Share to upload animations without forcing a local download.
   */
  asBlob?: boolean
}

export type AnimationExportBlobResult = {
  blob: Blob
  contentType: string
  extension: string
}

export type WatermarkAssets = {
  logo: HTMLImageElement | null
  /**
   * Resolved font stack to draw the watermark with. The app's Inter is loaded
   * by next/font under a hashed family name (not the literal "Inter"), so we
   * resolve and preload the real family before capture — otherwise canvas falls
   * back to each OS's `system-ui`, making the exported credit look different on
   * Windows/Linux/macOS.
   */
  fontStack: string
}

export type CaptureCtx = {
  capture: AnimationCapture
  canvas: CanvasState
  globalAspect: { id: string; w: number; h: number }
  clips: AnimationClip[]
  frameCount: number
  frameDurationMs: number
  fps: number
  progress: ProgressReporter
  signal?: AbortSignal
  /** Non-null when the watermark should be painted onto every frame. */
  watermark: WatermarkAssets | null
}

export const MAX_FRAMES = 600
