/**
 * MP4/WebM encode via WebCodecs (mediabunny): styled frames on the video track,
 * the source clip's audio remuxed or re-encoded alongside it.
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

import { exportDebugLog, getActiveExportDebug } from "../export-debug"
import type { WatermarkAssets } from "../types"
import {
  AnimationExportAbortedError,
  type createProgressReporter,
  throwIfAborted,
} from "../utils"
import { prepareSourceAudio } from "./audio"
import { blitFrame, type FramePlan, type RenderFrame } from "./frames"

export async function encodeMp4OrWebm(
  format: "mp4" | "webm",
  ctx: CanvasRenderingContext2D,
  encodeCanvas: HTMLCanvasElement,
  renderFrame: RenderFrame,
  watermark: WatermarkAssets | null,
  plan: FramePlan,
  progress: ReturnType<typeof createProgressReporter>,
  durationSec: number,
  sourceSrc: string,
  signal?: AbortSignal
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    exportDebugLog("error", "encode", "VideoEncoder undefined")
    throw new Error("Video encoding is not supported in this browser")
  }
  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])
  exportDebugLog("info", "encode", "probing video codec", {
    format,
    preferred,
    width: encodeCanvas.width,
    height: encodeCanvas.height,
  })
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width: encodeCanvas.width,
    height: encodeCanvas.height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) {
    exportDebugLog("error", "encode", "no encodable video codec", {
      preferred,
    })
    throw new Error("No supported video codec for this format")
  }
  exportDebugLog("info", "encode", "selected video codec", { codec })
  getActiveExportDebug()?.setMeta("videoCodec", codec)

  const outputFormat =
    format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat()
  // Best-effort: missing/unusable audio → silent video, never fail the export.
  const sourceAudio = await prepareSourceAudio(
    sourceSrc,
    format,
    outputFormat,
    durationSec,
    signal
  )
  exportDebugLog("info", "encode", "source audio prepared", {
    hasAudio: !!sourceAudio,
    durationSec,
  })
  getActiveExportDebug()?.setMeta("hasSourceAudio", !!sourceAudio)

  const target = new BufferTarget()
  const output = new Output({
    format: outputFormat,
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
      progress.report("encoding", 0, 1)
      const audioStarted = performance.now()
      await sourceAudio.feed()
      exportDebugLog("info", "encode", "audio feed complete", {
        durationMs: Math.round(performance.now() - audioStarted),
      })
    }
    progress.report("capturing", 0, plan.frameCount)
    exportDebugLog("info", "encode", "frame loop begin", {
      frameCount: plan.frameCount,
    })
    const loopStarted = performance.now()
    for (let f = 0; f < plan.frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()
      const frame = await renderFrame(f)
      blitFrame(ctx, frame, encodeCanvas.width, encodeCanvas.height, watermark)
      await videoSource.add(plan.timeForFrame(f), plan.frameDurationSec)
      progress.report("capturing", f + 1, plan.frameCount)
      if (f === 0 || f === plan.frameCount - 1 || (f + 1) % 30 === 0) {
        exportDebugLog(
          "debug",
          "encode",
          `encoded frame ${f + 1}/${plan.frameCount}`,
          {
            frameIndex: f,
            elapsedMs: Math.round(performance.now() - loopStarted),
          }
        )
      }
    }
    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    exportDebugLog("info", "encode", "finalizing mux", {
      frameLoopMs: Math.round(performance.now() - loopStarted),
    })
    await output.finalize()
    progress.report("encoding", 1, 1)
    const buffer = target.buffer
    if (!buffer || buffer.byteLength === 0) {
      exportDebugLog("error", "encode", "empty output buffer")
      throw new Error("Video encode produced an empty file")
    }
    const mime = format === "mp4" ? "video/mp4" : "video/webm"
    exportDebugLog("info", "encode", "mux complete", {
      byteLength: buffer.byteLength,
      mime,
    })
    getActiveExportDebug()?.setMeta("encodedBytes", buffer.byteLength)
    return new Blob([buffer], { type: mime })
  } finally {
    signal?.removeEventListener("abort", onAbort)
    sourceAudio?.cleanup()
  }
}
