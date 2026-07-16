/**
 * Fully local animation export (user device only — no server).
 *
 * Pipeline:
 *  1. Sample Tokokino keyframes onto an offscreen DOM clone (html-to-image)
 *  2. GIF  → gifenc (pure JS palette encode)
 *  3. Video → Mediabunny + WebCodecs (hardware-accelerated, faster than real-time)
 *             with MediaRecorder fallback when WebCodecs is unavailable
 *
 * A video canvas needs its clip decoded and painted into the clone per frame
 * (`video-layer`) — a `<video>` renders nothing once the clone is serialized —
 * and its audio re-timed onto the timeline (`animation-audio`).
 *
 * This module wires the pieces together; the heavy lifting lives in sibling
 * files: `capture` (frame rasterization), `gif`/`video` (encoders),
 * `watermark`, `draw-utils`, and `utils`.
 */

import { clearAnimationFrameVars } from "../apply-animation-frame"
import { isVideoSrc } from "../media-type"
import { captureClipPose, useEditorStore } from "../store"
import { acquireAnimationCapture, suppressCloneTransitions } from "./capture"
import {
  collectCanvasStyleSnapshot,
  startExportDebug,
  type ExportDebugSession,
} from "./export-debug"
import { encodeGif } from "./gif"
import { prepareCloneVideoLayer } from "./video-layer"
import {
  MAX_FRAMES,
  type AnimationExportBlobResult,
  type AnimationExportOptions,
  type CaptureCtx,
} from "./types"
import {
  AnimationExportAbortedError,
  animationMimeAndExt,
  createProgressReporter,
  resolveAnimationDownloadFilename,
  throwIfAborted,
  triggerDownload,
} from "./utils"
import { encodeWebmMediaRecorder, tryEncodeWithMediabunny } from "./video"
import { loadWatermarkLogo, resolveWatermarkFontStack } from "./watermark"

export { AnimationExportAbortedError } from "./utils"
export { isWebmExportSupported } from "./video"
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
  const targetWidth =
    options.targetWidth ??
    (options.format === "gif" ? 720 : options.format === "mp4" ? 1080 : 1080)
  const filename = await resolveAnimationDownloadFilename({
    canvasId,
    scale: options.scale ?? String(targetWidth),
    targetWidth,
    extension: result.extension,
  })
  triggerDownload(result.blob, filename)
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
  const dbg: ExportDebugSession | null = startExportDebug("animation", canvasId)

  try {
    throwIfAborted(signal)
    progress.report("preparing", 0, 1)

    const state = useEditorStore.getState()
    const canvas = state.present.canvases.find((c) => c.id === canvasId)
    const animation = canvas?.animation
    if (!canvas || !animation) throw new Error("Nothing to export")

    const { durationMs } = animation
    const clips =
      state.isAnimateMode && state.selectedAnimationClipId
        ? animation.clips.map((clip) =>
            clip.id === state.selectedAnimationClipId
              ? { ...clip, pose: captureClipPose(canvas) }
              : clip
          )
        : animation.clips
    if (!clips.length)
      throw new Error("Add at least one keyframe before sharing")

    const fps = Math.max(1, Math.min(60, options.fps ?? 30))
    const frameCount = Math.min(
      MAX_FRAMES,
      Math.max(1, Math.round((durationMs / 1000) * fps))
    )
    const frameDurationMs = 1000 / fps
    const targetWidth =
      options.targetWidth ??
      (options.format === "gif" ? 720 : options.format === "mp4" ? 1080 : 1080)

    dbg?.mergeMeta({
      options: {
        format: options.format,
        fps,
        targetWidth,
        capture: options.capture ?? "auto",
        watermark: options.watermark !== false,
        asBlob: !!options.asBlob,
      },
      canvasStyle: collectCanvasStyleSnapshot(canvas),
      animation: {
        durationMs,
        clipCount: clips.length,
        frameCount,
        frameDurationMs,
      },
    })
    dbg?.info("prepare", "starting animation encode", {
      format: options.format,
      fps,
      frameCount,
      targetWidth,
      captureMode: options.capture ?? "auto",
    })

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
    dbg?.info("capture", "acquireAnimationCapture begin", {
      mode: options.capture ?? "auto",
    })
    const captureStarted = performance.now()
    const capture = await acquireAnimationCapture(
      canvasId,
      targetWidth,
      options.capture ?? "auto"
    )
    dbg?.info("capture", "acquireAnimationCapture done", {
      durationMs: Math.round(performance.now() - captureStarted),
      width: capture.width,
      height: capture.height,
      needsPaint: capture.needsPaint,
    })
    dbg?.setMeta("capture", {
      width: capture.width,
      height: capture.height,
      needsPaint: capture.needsPaint,
    })
    suppressCloneTransitions(capture.node)
    dbg?.logCloneFilters(capture.node)

    // A `<video>` renders nothing once the clone is serialized into an SVG, so a
    // video canvas needs its frames decoded and painted in per capture.
    const screenshot = canvas.screenshot
    const videoLayer =
      screenshot && isVideoSrc(screenshot)
        ? await prepareCloneVideoLayer({
            node: capture.node,
            src: screenshot,
            videoClips: canvas.videoClips ?? [],
            signal,
          })
        : null
    dbg?.info(
      "video-layer",
      videoLayer ? "clone video layer ready" : "no video layer",
      {
        hasVideoLayer: !!videoLayer,
        sourceDurationMs: videoLayer?.sourceDurationMs ?? null,
      }
    )

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
      videoLayer,
    }

    try {
      let blob: Blob
      let encoder: string
      if (options.format === "gif") {
        encoder = "gif"
        blob = await encodeGif(ctx)
      } else {
        const encoded = await tryEncodeWithMediabunny(ctx, options.format)
        if (encoded) {
          encoder = "mediabunny"
          blob = encoded
        } else {
          if (options.format === "mp4") {
            throw new Error(
              "MP4 export needs WebCodecs (Chrome, Edge, or Safari 17+). Try WebM or update your browser."
            )
          }
          // WebM fallback — MediaRecorder (also fully local)
          encoder = "mediarecorder-webm"
          dbg?.warn("encode", "falling back to MediaRecorder WebM")
          blob = await encodeWebmMediaRecorder({
            ...ctx,
            durationMs,
          })
        }
      }
      progress.report("finishing", 1, 1)
      const { contentType, extension } = animationMimeAndExt(options.format)
      dbg?.mergeMeta({
        encoder,
        result: {
          contentType: blob.type || contentType,
          extension,
          blobSize: blob.size,
          blobType: blob.type,
        },
      })
      dbg?.info("result", "animation encode complete", {
        encoder,
        blobSize: blob.size,
        extension,
      })
      await dbg?.flush("success")
      // Prefer the blob's own type when the encoder set one.
      return {
        blob,
        contentType: blob.type || contentType,
        extension,
      }
    } finally {
      videoLayer?.cleanup()
      clearAnimationFrameVars(capture.node, clips)
      capture.cleanup()
      dbg?.info("capture", "capture cleaned up")
    }
  } catch (err) {
    const aborted = err instanceof AnimationExportAbortedError
    dbg?.error("export", aborted ? "export aborted" : "export failed", {
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : String(err),
    })
    await dbg?.flush(aborted ? "aborted" : "error", err)
    throw err
  }
}
