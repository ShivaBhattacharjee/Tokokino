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
import {
  collectCanvasStyleSnapshot,
  getActiveExportDebug,
  startExportDebug,
  type ExportDebugSession,
} from "../export-debug"
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

/**
 * The export rasterizes an offscreen *clone*, so the exported framing can only
 * match the editor if the clone lays out identically. Everything downstream
 * (scene template, projected quad) is measured on the clone and is therefore
 * self-consistent even when the clone itself is framed wrong — which makes that
 * class of bug invisible in the rest of the log. Compare the live canvas and the
 * clone directly, as fractions of their own canvas box, so a mismatch is obvious.
 */
function logLiveVsCloneFraming(canvasId: string, cloneNode: HTMLElement) {
  const dbg = getActiveExportDebug()
  if (!dbg) return

  const frame = (root: HTMLElement | null) => {
    const media = root?.querySelector("video")
    if (!root || !media) return null
    const rootRect = root.getBoundingClientRect()
    const box = media.getBoundingClientRect()
    if (!rootRect.width || !rootRect.height) return null
    return {
      canvasW: Number(rootRect.width.toFixed(2)),
      canvasH: Number(rootRect.height.toFixed(2)),
      aspect: Number((rootRect.width / rootRect.height).toFixed(4)),
      // Transformed media box as a fraction of the canvas — resolution-independent,
      // so the live canvas and the (differently scaled) clone are comparable.
      mediaPct: {
        left: Number(((box.left - rootRect.left) / rootRect.width).toFixed(4)),
        top: Number(((box.top - rootRect.top) / rootRect.height).toFixed(4)),
        width: Number((box.width / rootRect.width).toFixed(4)),
        height: Number((box.height / rootRect.height).toFixed(4)),
      },
    }
  }

  const live = frame(
    document.querySelector<HTMLElement>(`[data-canvas-id="${canvasId}"]`)
  )
  const clone = frame(cloneNode)
  if (!live || !clone) {
    dbg.info("framing", "live/clone framing unavailable", {
      hasLive: !!live,
      hasClone: !!clone,
    })
    return
  }

  const drift = {
    left: Number((clone.mediaPct.left - live.mediaPct.left).toFixed(4)),
    top: Number((clone.mediaPct.top - live.mediaPct.top).toFixed(4)),
    width: Number((clone.mediaPct.width - live.mediaPct.width).toFixed(4)),
    height: Number((clone.mediaPct.height - live.mediaPct.height).toFixed(4)),
    aspect: Number((clone.aspect - live.aspect).toFixed(4)),
  }
  // 0.5% of the canvas — past rounding, under "you'd never notice".
  const matches = Math.max(...Object.values(drift).map(Math.abs)) <= 0.005

  dbg.setMeta("framing", { live, clone, drift, matches })
  dbg.log(
    matches ? "info" : "warn",
    "framing",
    matches
      ? "clone framing matches the editor"
      : "clone framing DIFFERS from the editor — export will not match the canvas",
    { live, clone, drift }
  )
}

async function encodeVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<AnimationExportBlobResult> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)
  const dbg: ExportDebugSession | null = startExportDebug(
    "video-media",
    canvasId
  )

  try {
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

    dbg?.mergeMeta({
      options: {
        format,
        fps,
        targetWidth,
        scale: options.scale ?? null,
        watermark: options.watermark !== false,
        asBlob: !!options.asBlob,
      },
      canvasStyle: collectCanvasStyleSnapshot(canvas),
      supportsObjectViewBox: supportsObjectViewBox(),
    })
    dbg?.info("prepare", "starting video-media encode", {
      format,
      fps,
      targetWidth,
    })

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
    dbg?.info("prepare", "watermark assets ready", {
      hasLogo: !!watermark?.logo,
      fontStack: watermark?.fontStack ?? null,
    })

    // Offscreen clone of the styled canvas, rasterized per frame (handles tilt,
    // crop, frames, shadow — everything the DOM renders).
    dbg?.info("capture", "prepareAnimationCapture begin")
    const captureStarted = performance.now()
    const capture = await prepareAnimationCapture(canvasId, targetWidth)
    dbg?.info("capture", "prepareAnimationCapture done", {
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
    dbg?.logCloneFilters(capture.node)
    logLiveVsCloneFraming(canvasId, capture.node)

    try {
      const cloneVideo = capture.node.querySelector("video")
      if (!cloneVideo)
        throw new Error("Video element not found in export clone")
      cloneVideo.muted = true
      cloneVideo.preload = "auto"
      dbg?.info("video", "waiting for clone <video> ready", {
        readyState: cloneVideo.readyState,
        networkState: cloneVideo.networkState,
        videoWidth: cloneVideo.videoWidth,
        videoHeight: cloneVideo.videoHeight,
        currentSrcKind: cloneVideo.currentSrc
          ? cloneVideo.currentSrc.startsWith("blob:")
            ? "blob"
            : cloneVideo.currentSrc.startsWith("data:")
              ? "data"
              : "url"
          : null,
      })
      await waitForVideoReady(cloneVideo)
      dbg?.info("video", "clone <video> ready", {
        readyState: cloneVideo.readyState,
        duration: cloneVideo.duration,
        videoWidth: cloneVideo.videoWidth,
        videoHeight: cloneVideo.videoHeight,
      })

      const durationSec = cloneVideo.duration
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        throw new Error("Video has no readable duration")
      }
      const plan = planFrames(durationSec, fps)
      dbg?.setMeta("plan", {
        durationSec,
        fps,
        frameCount: plan.frameCount,
        frameDurationSec: plan.frameDurationSec,
      })
      dbg?.info("plan", "frame plan", {
        durationSec,
        frameCount: plan.frameCount,
        fps,
      })

      const width = even(capture.width)
      const height = even(capture.height)
      const encodeCanvas = document.createElement("canvas")
      encodeCanvas.width = width
      encodeCanvas.height = height
      const ctx = encodeCanvas.getContext("2d")
      if (!ctx) throw new Error("Could not get 2d context")
      dbg?.setMeta("encodeCanvas", { width, height })

      // Safari/Firefox render a live <video> unreliably inside html-to-image's
      // serialized SVG (foreignObject), and rasterizing it per frame flickers.
      // There we decode frames with WebCodecs (mediabunny). Chromium rasterizes the
      // <video> in SVG fine, so it keeps the DOM-seek path. If decode isn't possible
      // (codec not WebCodecs-decodable), fall back to the DOM path too.
      const useDomPath = supportsObjectViewBox()
      dbg?.info("decode", "selecting frame source", {
        supportsObjectViewBox: useDomPath,
        preferDecoded: !useDomPath,
      })
      const decoded = useDomPath
        ? null
        : await createDecodedFrameSource(canvas.screenshot, signal)
      dbg?.info(
        "decode",
        decoded
          ? "WebCodecs decode source ready"
          : "no decoded source (DOM path)",
        {
          hasDecoded: !!decoded,
        }
      )
      dbg?.setMeta("decodedFrameSource", { hasDecoded: !!decoded })

      const tilt = canvas.tilt
      const tilted = !!tilt && (tilt.rx !== 0 || tilt.ry !== 0 || tilt.rz !== 0)
      // Enhance filters the media's own pixels, and the composite path draws
      // those pixels itself — so it has to re-apply it. Layers that merely sit
      // above the media are handled by the foreground pass (see export-stack).
      const mediaFx = { enhance: canvas.enhance }
      dbg?.info("renderer", "createFrameRenderer begin", {
        tilted,
        tilt,
        mediaFx,
      })
      const renderFrame = await createFrameRenderer({
        capture,
        video: cloneVideo,
        decoded,
        tilted,
        plan,
        signal,
        mediaFx,
      })
      dbg?.info("renderer", "createFrameRenderer done")

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
        dbg?.mergeMeta({
          result: {
            contentType,
            extension,
            blobSize: blob.size,
            blobType: blob.type,
          },
        })
        dbg?.info("result", "encode complete", {
          contentType,
          extension,
          blobSize: blob.size,
        })
        await dbg?.flush("success")
        return { blob, contentType, extension }
      } finally {
        decoded?.cleanup()
      }
    } finally {
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
