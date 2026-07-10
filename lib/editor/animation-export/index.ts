/**
 * Fully local animation export (user device only — no server).
 *
 * Pipeline:
 *  1. Sample Tokokino keyframes onto an offscreen DOM clone (html-to-image)
 *  2. GIF  → gifenc (pure JS palette encode)
 *  3. Video → Mediabunny + WebCodecs (hardware-accelerated, faster than real-time)
 *             with MediaRecorder fallback when WebCodecs is unavailable
 *
 * This module wires the pieces together; the heavy lifting lives in sibling
 * files: `capture` (frame rasterization), `gif`/`video` (encoders),
 * `watermark`, `draw-utils`, and `utils`.
 */

import { clearAnimationFrameVars } from "../apply-animation-frame"
import { captureClipPose, useEditorStore } from "../store"
import { acquireAnimationCapture, suppressCloneTransitions } from "./capture"
import { encodeGif } from "./gif"
import {
  MAX_FRAMES,
  type AnimationExportBlobResult,
  type AnimationExportOptions,
  type CaptureCtx,
} from "./types"
import {
  animationMimeAndExt,
  createProgressReporter,
  throwIfAborted,
  triggerDownload,
} from "./utils"
import { encodeWebmMediaRecorder, tryEncodeWithMediabunny } from "./video"
import { loadWatermarkLogo, resolveWatermarkFontStack } from "./watermark"

export { AnimationExportAbortedError } from "./utils"
export type {
  AnimationCaptureMode,
  AnimationExportBlobResult,
  AnimationExportFormat,
  AnimationExportOptions,
  AnimationExportPhase,
  AnimationExportProgress,
} from "./types"

/**
 * Render the active canvas's animation timeline.
 * 100% on-device encode — download by default, or return a blob for Share.
 */
export async function exportAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<void | AnimationExportBlobResult> {
  const result = await encodeAnimation(canvasId, options)
  if (options.asBlob) return result
  triggerDownload(
    result.blob,
    `tokokino-animation-${Date.now()}.${result.extension}`
  )
}

/** Encode animation and always return the blob (for share uploads). */
export async function exportAnimationBlob(
  canvasId: string,
  options: Omit<AnimationExportOptions, "asBlob">
): Promise<AnimationExportBlobResult> {
  return encodeAnimation(canvasId, { ...options, asBlob: true })
}

async function encodeAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<AnimationExportBlobResult> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)

  throwIfAborted(signal)
  progress.report("preparing", 0, 1)

  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  const animation = canvas?.animation
  if (!canvas || !animation) throw new Error("Nothing to export")

  const { durationMs, audio } = animation
  const clips =
    state.isAnimateMode && state.selectedAnimationClipId
      ? animation.clips.map((clip) =>
          clip.id === state.selectedAnimationClipId
            ? { ...clip, pose: captureClipPose(canvas) }
            : clip
        )
      : animation.clips
  if (!clips.length) throw new Error("Add at least one keyframe before sharing")

  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const frameCount = Math.min(
    MAX_FRAMES,
    Math.max(1, Math.round((durationMs / 1000) * fps))
  )
  const frameDurationMs = 1000 / fps
  const targetWidth =
    options.targetWidth ??
    (options.format === "gif" ? 720 : options.format === "mp4" ? 1080 : 1080)

  // Added unless explicitly disabled — mirrors the still-image export toggle.
  // Preload the logo and the real Inter family together so every frame's canvas
  // text rasterizes identically across OSes (no per-platform system-ui fallback).
  const watermark =
    options.watermark === false
      ? null
      : await (async () => {
          const [logo, fontStack] = await Promise.all([
            loadWatermarkLogo(),
            resolveWatermarkFontStack(),
          ])
          return { logo, fontStack }
        })()

  throwIfAborted(signal)
  const capture = await acquireAnimationCapture(
    canvasId,
    targetWidth,
    options.capture ?? "auto"
  )
  suppressCloneTransitions(capture.node)
  progress.report("preparing", 1, 1)

  const ctx: CaptureCtx = {
    capture,
    canvas,
    globalAspect: state.present.aspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
    watermark,
  }

  try {
    let blob: Blob
    if (options.format === "gif") {
      blob = await encodeGif(ctx)
    } else {
      const encoded = await tryEncodeWithMediabunny(ctx, options.format)
      if (encoded) {
        blob = encoded
      } else {
        if (options.format === "mp4") {
          throw new Error(
            "MP4 export needs WebCodecs (Chrome, Edge, or Safari 17+). Try WebM or update your browser."
          )
        }
        // WebM fallback — MediaRecorder (also fully local)
        blob = await encodeWebmMediaRecorder({
          ...ctx,
          durationMs,
          audio: audio && !audio.muted && audio.src ? audio : null,
        })
      }
    }
    progress.report("finishing", 1, 1)
    const { contentType, extension } = animationMimeAndExt(options.format)
    // Prefer the blob's own type when the encoder set one.
    return {
      blob,
      contentType: blob.type || contentType,
      extension,
    }
  } finally {
    clearAnimationFrameVars(capture.node, clips)
    capture.cleanup()
  }
}
