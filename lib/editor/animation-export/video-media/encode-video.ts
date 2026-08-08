/**
 * MP4/WebM encode via WebCodecs (mediabunny): styled frames on the video track,
 * the source clip's audio remuxed or re-encoded alongside it.
 *
 * Preferred path hands the muxer and the audio to a worker (see
 * `workers/video-muxer-client.ts`) and keeps only the frame rasterization here,
 * since that needs the DOM. The in-process encoder below is the fallback for
 * browsers without workers or when the worker can't start.
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

import { ENCODE_KEY_FRAME_INTERVAL_SEC } from "../../encode-settings"
import { isAnimationExportAborted } from "../abort"
import type { WatermarkAssets } from "../types"
import {
  AnimationExportAbortedError,
  type createProgressReporter,
  createUiYielder,
  throwIfAborted,
} from "../utils"
import { createVideoMuxSession } from "../workers/video-muxer-client"
import { loadAudioSourceBlob, prepareSourceAudio } from "./audio"
import { blitFrame, type FramePlan, type RenderFrame } from "./frames"

type Progress = ReturnType<typeof createProgressReporter>

/**
 * Render each planned frame into `encodeCanvas` and hand it to `addFrame`.
 * Shared by the worker and in-process encoders — the render half is main-thread
 * either way.
 */
async function pumpFrames(
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: RenderFrame,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: Progress,
  signal: AbortSignal | undefined,
  addFrame: (timestampSec: number, durationSec: number) => Promise<void>
) {
  const yieldToUi = createUiYielder()
  progress.report("capturing", 0, plan.frameCount)
  for (let f = 0; f < plan.frameCount; f++) {
    // Rasterizing a frame is main-thread DOM work; yield between frames so
    // Cancel stays clickable and the progress bar can repaint.
    await yieldToUi()
    throwIfAborted(signal)
    blitFrame(
      ctx,
      await renderFrame(f),
      encodeCanvas.width,
      encodeCanvas.height,
      watermark
    )
    await addFrame(plan.timeForFrame(f), plan.frameDurationSec)
    progress.report("capturing", f + 1, plan.frameCount)
  }
}

async function tryEncodeInWorker(
  format: "mp4" | "webm",
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: RenderFrame,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: Progress,
  durationSec: number,
  audioBlob: Blob | null,
  signal?: AbortSignal
): Promise<Blob | null> {
  // Audio is decoded and re-encoded inside the worker during init, so report the
  // phase around the handshake rather than around a separate feed step.
  if (audioBlob) progress.report("audio", 0, 1)

  const session = await createVideoMuxSession(
    {
      format,
      width: encodeCanvas.width,
      height: encodeCanvas.height,
      fps: Math.round(1 / plan.frameDurationSec),
      keyFrameIntervalSec: ENCODE_KEY_FRAME_INTERVAL_SEC,
      // This export plays the clip start to finish, so source and export time
      // already agree — no timeline re-timing, hence no segments.
      audio: audioBlob
        ? { blob: audioBlob, durationSec, segments: null }
        : null,
    },
    signal
  )
  if (!session) return null

  try {
    await pumpFrames(
      ctx,
      encodeCanvas,
      renderFrame,
      watermark,
      plan,
      progress,
      signal,
      (timestampSec, frameDurationSec) =>
        session.addFrame(encodeCanvas, timestampSec, frameDurationSec)
    )
    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    const buffer = await session.finalize()
    progress.report("encoding", 1, 1)
    return new Blob([buffer], {
      type: format === "mp4" ? "video/mp4" : "video/webm",
    })
  } finally {
    session.dispose()
  }
}

/** Encode planned frames to MP4 or WebM via Mediabunny + WebCodecs. */
export async function encodeMp4OrWebm(
  format: "mp4" | "webm",
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: RenderFrame,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: Progress,
  durationSec: number,
  sourceSrc: string,
  signal?: AbortSignal
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("Video encoding is not supported in this browser")
  }

  // Read once and share with the fallback: this is the whole source clip, and
  // re-reading it on the fallback path doubles the cost for a long video.
  // Best-effort — missing/unusable audio → silent video, never fail the export.
  const audioBlob = await loadAudioSourceBlob(sourceSrc, signal)

  try {
    const encoded = await tryEncodeInWorker(
      format,
      ctx,
      encodeCanvas,
      renderFrame,
      watermark,
      plan,
      progress,
      durationSec,
      audioBlob,
      signal
    )
    if (encoded) return encoded
  } catch (err) {
    if (isAnimationExportAborted(err)) throw err
    // Anything else falls through to the in-process encoder, which is a genuine
    // second chance rather than a repeat of the same failure.
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
  if (!codec) {
    throw new Error("No supported video codec for this format")
  }

  const outputFormat =
    format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat()
  const sourceAudio = audioBlob
    ? await prepareSourceAudio(
        audioBlob,
        format,
        outputFormat,
        durationSec,
        signal
      )
    : null
  const target = new BufferTarget()
  const output = new Output({
    format: outputFormat,
    target,
  })
  const videoSource = new CanvasSource(encodeCanvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: ENCODE_KEY_FRAME_INTERVAL_SEC,
  })
  output.addVideoTrack(videoSource, {
    frameRate: Math.round(1 / plan.frameDurationSec),
  })
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
    // Mux audio before the (much larger) video track so the output doesn't
    // buffer every video packet waiting for the first audio packet.
    if (sourceAudio) {
      progress.report("audio", 0, 1)
      await sourceAudio.feed()
      progress.report("audio", 1, 1)
    }
    await pumpFrames(
      ctx,
      encodeCanvas,
      renderFrame,
      watermark,
      plan,
      progress,
      signal,
      async (timestampSec, frameDurationSec) => {
        if (cancelled) throw new AnimationExportAbortedError()
        await videoSource.add(timestampSec, frameDurationSec)
      }
    )
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
    sourceAudio?.cleanup()
  }
}
