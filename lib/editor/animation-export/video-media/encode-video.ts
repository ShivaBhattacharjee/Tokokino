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

import type { WatermarkAssets } from "../types"
import {
  AnimationExportAbortedError,
  type createProgressReporter,
  throwIfAborted,
} from "../utils"
import { prepareSourceAudio } from "./audio"
import { blitFrame, type FramePlan, type RenderFrame } from "./frames"

/** Encode planned frames to MP4 or WebM via Mediabunny + WebCodecs. */
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
  if (!codec) {
    throw new Error("No supported video codec for this format")
  }

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
      await sourceAudio.feed()
    }
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
    sourceAudio?.cleanup()
  }
}
