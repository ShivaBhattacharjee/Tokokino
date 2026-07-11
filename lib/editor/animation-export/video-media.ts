/**
 * Video-media export — turns a canvas whose main content is a *video* into a
 * downloadable video (MP4/WebM) or GIF, with all styling applied.
 *
 * It reuses the animation export's frame pipeline: an offscreen clone of the
 * canvas is rasterized per frame via html-to-image, so background, shadow,
 * frame, border, 3D tilt, crop and other layers all render exactly as on canvas
 * — the only thing we add is seeking the clone's <video> to each output time so
 * the clip actually moves. (The earlier hand-rolled 2D compositor couldn't
 * reproduce 3D tilt and stretched the frame; this doesn't have that problem.)
 *
 * v1 caveat: no audio track.
 */

import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from "mediabunny"
import { GIFEncoder, quantize, applyPalette } from "gifenc"

import { prepareAnimationCapture } from "../export"
import { isVideoSrc } from "../media-type"
import { useEditorStore } from "../store"
import type {
  AnimationExportBlobResult,
  AnimationExportFormat,
  AnimationExportProgress,
  WatermarkAssets,
} from "./types"
import { safeDrawImage } from "./draw-utils"
import {
  AnimationExportAbortedError,
  animationMimeAndExt,
  createProgressReporter,
  even,
  throwIfAborted,
  triggerDownload,
  waitForPaint,
} from "./utils"
import {
  drawWatermark,
  loadWatermarkLogo,
  resolveWatermarkFontStack,
} from "./watermark"

export type VideoMediaExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
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

/** Wait until a (cloned, offscreen) video has decoded data ready to draw. */
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && Number.isFinite(video.duration)) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Could not load video for export"))
    }
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("error", onError)
    video.load()
  })
}

/**
 * Seek the clone video and wait for the frame to be ready to draw. Rejects on a
 * decode error (surfaces to the outer catch) or when the export is aborted — a
 * `"seeked"` that never fires would otherwise hang the whole render loop, and
 * the between-frames abort check can't interrupt a stuck seek.
 */
export function seekTo(
  video: HTMLVideoElement,
  timeSec: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const clamped = Math.max(0, Math.min(timeSec, (video.duration || 0) - 1e-3))
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      signal?.removeEventListener("abort", onAbort)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Video decode failed during seek"))
    }
    const onAbort = () => {
      cleanup()
      reject(new AnimationExportAbortedError())
    }
    if (signal?.aborted) {
      reject(new AnimationExportAbortedError())
      return
    }
    if (Math.abs(video.currentTime - clamped) < 1e-3) {
      resolve()
      return
    }
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)
    signal?.addEventListener("abort", onAbort, { once: true })
    video.currentTime = clamped
  })
}

type FramePlan = {
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

/** Draw a captured frame canvas into the (even-sized) encode canvas + watermark. */
function blitFrame(
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

    const renderFrame = async (i: number): Promise<HTMLCanvasElement> => {
      await seekTo(cloneVideo, plan.timeForFrame(i), signal)
      if (capture.needsPaint) await waitForPaint()
      return capture.captureFrame()
    }

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
            signal
          )

    progress.report("finishing", 1, 1)
    const { contentType, extension } = animationMimeAndExt(format)
    return { blob, contentType, extension }
  } finally {
    capture.cleanup()
  }
}

async function encodeMp4OrWebm(
  format: "mp4" | "webm",
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: (i: number) => Promise<HTMLCanvasElement>,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  signal?: AbortSignal
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("Video encoding is not supported in this browser")
  }
  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width: encodeCanvas.width,
    height: encodeCanvas.height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) throw new Error("No supported video codec for this format")

  const target = new BufferTarget()
  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  })
  const videoSource = new CanvasSource(encodeCanvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, {
    frameRate: Math.round(1 / plan.frameDurationSec),
  })

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    void output.cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    throwIfAborted(signal)
    await output.start()
    progress.report("capturing", 0, plan.frameCount)
    for (let f = 0; f < plan.frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()
      const frame = await renderFrame(f)
      blitFrame(ctx, frame, encodeCanvas.width, encodeCanvas.height, watermark)
      await videoSource.add(plan.timeForFrame(f), plan.frameDurationSec)
      progress.report("capturing", f + 1, plan.frameCount)
    }
    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    await output.finalize()
    progress.report("encoding", 1, 1)
    const buffer = target.buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video encode produced an empty file")
    }
    const mime = format === "mp4" ? "video/mp4" : "video/webm"
    return new Blob([buffer], { type: mime })
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}

async function encodeGif(
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: (i: number) => Promise<HTMLCanvasElement>,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  signal?: AbortSignal
): Promise<Blob> {
  const w = encodeCanvas.width
  const h = encodeCanvas.height

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

/** Export the active video canvas as a video/GIF — downloads by default. */
export async function exportVideoMedia(
  canvasId: string,
  options: VideoMediaExportOptions
): Promise<void | AnimationExportBlobResult> {
  const result = await encodeVideoMedia(canvasId, options)
  if (options.asBlob) return result
  triggerDownload(
    result.blob,
    `tokokino-video-${Date.now()}.${result.extension}`
  )
}
