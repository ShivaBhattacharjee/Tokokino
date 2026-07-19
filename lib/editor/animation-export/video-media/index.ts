/**
 * Video-media export — turns a canvas whose main content is a *video* into a
 * downloadable video (MP4/WebM) or GIF, with all styling applied.
 *
 * The styled scene (background, shadow, frame, border, tilt, crop…) always
 * comes from an offscreen clone rasterized once with html-to-image; decoded
 * video frames are then composited in 2D (including CSS 3D tilt via projected
 * quads). Per-frame foreignObject re-raster of a changing video overlay
 * flickers on Safari — see `frame-renderer.ts`.
 *
 * This module wires those pieces together: plan the frames (`frames.ts`), build
 * the renderer, and hand it to the GIF (`encode-gif.ts`) or MP4/WebM
 * (`encode-video.ts`) encoder.
 */

import { supportsObjectViewBox } from "../../crop-utils"
import { prepareAnimationCapture } from "../../export"
import { isVideoSrc } from "../../media-type"
import { useEditorStore } from "../../store"
import type {
  AnimationExportBlobResult,
  AnimationExportFormat,
  AnimationExportProgress,
  WatermarkAssets,
} from "../types"
import {
  AnimationExportAbortedError,
  animationMimeAndExt,
  createProgressReporter,
  even,
  resolveAnimationDownloadFilename,
  throwIfAborted,
  triggerDownload,
} from "../utils"
import { loadWatermarkLogo, resolveWatermarkFontStack } from "../watermark"
import { exportAudioDurationSec } from "./audio"
import { createDecodedFrameSource } from "./decoded-frames"
import { waitForVideoReady } from "./dom-video"
import { encodeGif } from "./encode-gif"
import { encodeMp4OrWebm } from "./encode-video"
import { createFrameRenderer } from "./frame-renderer"
import { planFrames } from "./frames"

export type VideoMediaExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
  /** Resolution label for `{SCALE}` in the export filename (e.g. "hd"). */
  scale?: string
  watermark?: boolean
  onProgress?: (progress: AnimationExportProgress) => void
  signal?: AbortSignal
  asBlob?: boolean
}

/** True when the active canvas's main content is a video (export eligibility). */
export function canvasIsVideoMedia(canvasId: string): boolean {
  const canvas = useEditorStore
    .getState()
    .present.canvases.find((c) => c.id === canvasId)
  return !!canvas && isVideoSrc(canvas.screenshot)
}

/** Capture → plan → decode → render → encode for a styled video canvas. */
async function encodeVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<AnimationExportBlobResult> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)

  throwIfAborted(signal)
  progress.report("preparing", 0, 1)

  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  if (!canvas || !canvas.screenshot || !isVideoSrc(canvas.screenshot)) {
    throw new Error("Canvas has no video to export")
  }

  const format = options.format
  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const targetWidth = even(options.targetWidth ?? 1080)

  const watermark: WatermarkAssets | null =
    options.watermark === false
      ? null
      : await (async () => {
          const [logo, fontStack] = await Promise.all([
            loadWatermarkLogo(),
            resolveWatermarkFontStack(),
          ])
          return { logo, fontStack }
        })()
  // Offscreen clone of the styled canvas, rasterized per frame (handles tilt,
  // crop, frames, shadow — everything the DOM renders).
  const capture = await prepareAnimationCapture(canvasId, targetWidth)

  try {
    const cloneVideo = capture.node.querySelector("video")
    if (!cloneVideo) throw new Error("Video element not found in export clone")
    cloneVideo.muted = true
    cloneVideo.preload = "auto"
    await waitForVideoReady(cloneVideo)

    const durationSec = cloneVideo.duration
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Video has no readable duration")
    }
    const plan = planFrames(durationSec, fps)

    const width = even(capture.width)
    const height = even(capture.height)
    const encodeCanvas = document.createElement("canvas")
    encodeCanvas.width = width
    encodeCanvas.height = height
    const ctx = encodeCanvas.getContext("2d")
    if (!ctx) throw new Error("Could not get 2d context")

    // Safari/Firefox render a live <video> unreliably inside html-to-image's
    // serialized SVG (foreignObject), and rasterizing it per frame flickers.
    // There we decode frames with WebCodecs (mediabunny). Chromium rasterizes the
    // <video> in SVG fine, so it keeps the DOM-seek path. If decode isn't possible
    // (codec not WebCodecs-decodable), fall back to the DOM path too.
    const useDomPath = supportsObjectViewBox()
    const decoded = useDomPath
      ? null
      : await createDecodedFrameSource(canvas.screenshot, signal)

    const tilt = canvas.tilt
    const tilted = !!tilt && (tilt.rx !== 0 || tilt.ry !== 0 || tilt.rz !== 0)
    // The composite renderer owns the decoded pixels. Re-apply media effects
    // there, including inner lighting: Safari can otherwise mis-rasterize its
    // CSS gradient through the foreground SVG pass.
    const mediaFx = {
      enhance: canvas.enhance,
      innerLighting:
        !supportsObjectViewBox() && canvas.backdrop.lighting.target === "inner"
          ? canvas.backdrop.lighting
          : null,
    }
    const renderFrame = await createFrameRenderer({
      capture,
      video: cloneVideo,
      decoded,
      tilted,
      plan,
      signal,
      mediaFx,
    })

    try {
      const blob =
        format === "gif"
          ? await encodeGif(
              ctx,
              encodeCanvas,
              renderFrame,
              watermark,
              plan,
              progress,
              signal
            )
          : await encodeMp4OrWebm(
              format,
              ctx,
              encodeCanvas,
              renderFrame,
              watermark,
              plan,
              progress,
              // Exact export length (frameCount / fps), not the raw clip
              // duration — keeps audio aligned with the styled video track.
              exportAudioDurationSec(plan),
              canvas.screenshot,
              signal
            )

      progress.report("finishing", 1, 1)
      const { contentType, extension } = animationMimeAndExt(format)
      return { blob, contentType, extension }
    } finally {
      decoded?.cleanup()
    }
  } finally {
    capture.cleanup()
  }
}

/** Export the active video canvas as a video/GIF — downloads by default. */
export async function exportVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<void | AnimationExportBlobResult> {
  const result = await encodeVideoMedia(canvasId, options)
  if (options.asBlob) return result
  const targetWidth = even(options.targetWidth ?? 1080)
  const filename = await resolveAnimationDownloadFilename({
    canvasId,
    scale: options.scale ?? String(targetWidth),
    targetWidth,
    extension: result.extension,
  })
  triggerDownload(result.blob, filename)
}
