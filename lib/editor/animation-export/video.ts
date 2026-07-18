/**
 * Video encode. Primary path is Mediabunny + WebCodecs (hardware-accelerated,
 * faster than real-time) for WebM/MP4; falls back to a real-time MediaRecorder
 * WebM encode when WebCodecs is unavailable.
 *
 * A video canvas carries its clip's audio, re-timed onto the timeline (see
 * `animation-audio`). The MediaRecorder fallback stays silent — it only runs
 * where WebCodecs is missing, which is also where the audio encode can't run.
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

import { isVideoSrc } from "../media-type"
import { prepareAnimationAudio } from "./animation-audio"
import { captureStableFrame } from "./capture"
import { safeDrawImage } from "./draw-utils"
import type { CaptureCtx } from "./types"
import { resolveVideoSegments } from "./video-layer"
import {
  AnimationExportAbortedError,
  even,
  pickWebmMimeType,
  throwIfAborted,
} from "./utils"
import { drawWatermark } from "./watermark"

/**
 * Whether this browser can actually produce a WebM file — true when WebCodecs can
 * encode a WebM codec (VP9/VP8/AV1) OR MediaRecorder records WebM. Safari does
 * neither (its WebCodecs is H.264/HEVC only, its MediaRecorder is MP4 only), so
 * the export UI disables the WebM option there instead of failing mid-export.
 */
export async function isWebmExportSupported(): Promise<boolean> {
  if (pickWebmMimeType()) return true
  if (typeof VideoEncoder === "undefined") return false
  try {
    const codec = await getFirstEncodableVideoCodec(["vp9", "vp8", "av1"], {
      width: 640,
      height: 480,
      bitrate: QUALITY_HIGH,
    })
    return codec != null
  } catch {
    return false
  }
}

export async function tryEncodeWithMediabunny(
  ctx: CaptureCtx,
  format: "webm" | "mp4"
): Promise<Blob | null> {
  if (typeof VideoEncoder === "undefined") return null

  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])

  const width = even(ctx.capture.width)
  const height = even(ctx.capture.height)
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width,
    height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) return null

  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
    watermark,
    videoLayer,
  } = ctx

  // Working canvas we redraw each frame into (CanvasSource samples this).
  const encodeCanvas = document.createElement("canvas")
  encodeCanvas.width = width
  encodeCanvas.height = height
  const ectx = encodeCanvas.getContext("2d")
  if (!ectx) return null

  const target = new BufferTarget()
  const outputFormat =
    format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat()
  const output = new Output({ format: outputFormat, target })

  const videoSource = new CanvasSource(encodeCanvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, { frameRate: fps })

  // Best-effort, like the styled-video export: a clip with no usable audio still
  // exports, silently. Must be registered before `output.start()`.
  const screenshot = canvas.screenshot
  const sourceAudio =
    videoLayer && screenshot && isVideoSrc(screenshot)
      ? await prepareAnimationAudio({
          src: screenshot,
          format,
          outputFormat,
          segments: resolveVideoSegments(
            canvas.videoClips ?? [],
            videoLayer.sourceDurationMs
          ),
          exportDurationSec: frameCount / fps,
          signal,
        })
      : null
  sourceAudio?.addToOutput(output)

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    void output.cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    throwIfAborted(signal)
    await output.start()
    // Before the (much larger) video track, so the muxer doesn't buffer every
    // video packet waiting on the first audio one.
    if (sourceAudio) {
      progress.report("encoding", 0, 1)
      await sourceAudio.feed()
    }
    progress.report("capturing", 0, frameCount)

    const durationSec = 1 / fps
    for (let f = 0; f < frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()

      const frameCanvas = await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs,
        videoLayer
      )
      // Letterbox into even-sized encode canvas if needed.
      ectx.fillStyle = "#000"
      ectx.fillRect(0, 0, width, height)
      if (!safeDrawImage(ectx, frameCanvas, 0, 0, width, height)) {
        // Keep the black letterbox frame rather than aborting the whole export.
      }
      if (watermark) drawWatermark(ectx, width, height, watermark)

      const timestamp = f / fps
      await videoSource.add(timestamp, durationSec)
      progress.report("capturing", f + 1, frameCount)
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
  } catch (err) {
    if (!cancelled && output.state !== "canceled") {
      try {
        await output.cancel()
      } catch {
        /* ignore */
      }
    }
    if (
      err instanceof AnimationExportAbortedError ||
      (err instanceof Error && err.name === "AnimationExportAbortedError")
    ) {
      throw err
    }
    // Fall through to MediaRecorder for WebM only.
    return null
  } finally {
    signal?.removeEventListener("abort", onAbort)
    sourceAudio?.cleanup()
  }
}

export async function encodeWebmMediaRecorder({
  capture,
  canvas,
  globalAspect,
  clips,
  frameCount,
  frameDurationMs,
  progress,
  signal,
  durationMs,
  fps,
  watermark,
  videoLayer,
}: CaptureCtx & {
  durationMs: number
}) {
  // Safari's MediaRecorder records no WebM (MP4/H.264 only) and its WebCodecs
  // can't encode VP8/VP9, so we reach here with nothing able to produce WebM.
  // Bail before capturing frames instead of throwing NotSupportedError from
  // `new MediaRecorder`.
  const mimeType = pickWebmMimeType()
  if (!mimeType) {
    throw new Error(
      "WebM export isn't supported in this browser (e.g. Safari). Try MP4 or GIF instead."
    )
  }

  const frames: HTMLCanvasElement[] = []
  progress.report("capturing", 0, frameCount)

  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    frames.push(
      await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs,
        videoLayer
      )
    )
    progress.report("capturing", f + 1, frameCount)
  }

  if (frames.length === 0) throw new Error("No frames captured for WebM export")
  throwIfAborted(signal)
  progress.report("encoding", 0, frames.length)

  const out = document.createElement("canvas")
  out.width = frames[0]?.width || capture.width
  out.height = frames[0]?.height || capture.height
  const octx = out.getContext("2d")
  if (!octx) throw new Error("Could not get 2d context for export")
  if (!safeDrawImage(octx, frames[0], 0, 0)) {
    octx.fillStyle = "#000"
    octx.fillRect(0, 0, out.width, out.height)
  }
  if (watermark) drawWatermark(octx, out.width, out.height, watermark)

  const stream = out.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const drawFrame = (idx: number) => {
    const frame = frames[Math.max(0, Math.min(frames.length - 1, idx))]
    octx.clearRect(0, 0, out.width, out.height)
    if (!safeDrawImage(octx, frame, 0, 0)) {
      octx.fillStyle = "#000"
      octx.fillRect(0, 0, out.width, out.height)
    }
    if (watermark) drawWatermark(octx, out.width, out.height, watermark)
  }

  await new Promise<void>((resolve, reject) => {
    let rafId = 0
    let finished = false
    let lastReportedIdx = -1

    const cleanupMedia = () => {
      stream.getTracks().forEach((t) => t.stop())
    }

    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(rafId)
      try {
        if (recorder.state !== "inactive") recorder.stop()
        else {
          cleanupMedia()
          resolve()
        }
      } catch (err) {
        cleanupMedia()
        reject(
          err instanceof Error ? err : new Error("Failed to stop MediaRecorder")
        )
      }
    }

    const onAbort = () => {
      finish()
      reject(new AnimationExportAbortedError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    recorder.onstop = () => {
      signal?.removeEventListener("abort", onAbort)
      cleanupMedia()
      resolve()
    }
    recorder.onerror = () => {
      signal?.removeEventListener("abort", onAbort)
      finish()
      reject(new Error("MediaRecorder failed during WebM export"))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    try {
      recorder.start(100)
    } catch (err) {
      signal?.removeEventListener("abort", onAbort)
      reject(
        err instanceof Error ? err : new Error("Failed to start MediaRecorder")
      )
      return
    }

    const start = performance.now()
    const safeDuration = Math.max(frameDurationMs, durationMs)
    const tick = (now: number) => {
      if (finished) return
      if (signal?.aborted) {
        onAbort()
        return
      }
      const elapsed = now - start
      if (elapsed >= safeDuration) {
        drawFrame(frames.length - 1)
        progress.report("encoding", frames.length, frames.length)
        setTimeout(finish, Math.max(frameDurationMs, 50))
        return
      }
      const idx = Math.min(
        frames.length - 1,
        Math.max(0, Math.floor((elapsed / 1000) * fps))
      )
      drawFrame(idx)
      if (idx !== lastReportedIdx) {
        lastReportedIdx = idx
        progress.report("encoding", idx + 1, frames.length)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  throwIfAborted(signal)
  if (chunks.length === 0) throw new Error("WebM export produced an empty file")

  return new Blob(chunks, { type: mimeType })
}
