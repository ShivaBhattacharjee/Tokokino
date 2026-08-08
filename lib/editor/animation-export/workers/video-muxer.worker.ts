/**
 * Video mux worker. Owns the whole Mediabunny output for an MP4/WebM export:
 * codec negotiation, the muxer and its growing buffer, and the source clip's
 * audio (which is decoded and re-encoded here rather than on the main thread).
 *
 * The main thread keeps only what needs the DOM — rasterizing each styled frame
 * — and hands the pixels over as a transferred `VideoFrame`, so the encode, the
 * mux and the file assembly never block the UI.
 */

import {
  BufferTarget,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from "mediabunny"

import { AnimationExportAbortedError } from "../abort"
import { prepareAnimationAudio } from "../animation-audio"
import { prepareSourceAudio, type SourceAudioFeed } from "../video-media/audio"
import type {
  VideoMuxerConfig,
  VideoMuxerRequest,
  VideoMuxerResponse,
} from "./video-muxer-protocol"

type Session = {
  output: Output
  target: BufferTarget
  videoSource: VideoSampleSource
  audio: SourceAudioFeed | null
}

let session: Session | null = null
let aborter = new AbortController()

// Handlers are async, but `onmessage` fires again as soon as one returns — so
// without this chain frame N+1 could be encoded before frame N finished, and
// the muxer rejects out-of-order timestamps.
let queue: Promise<void> = Promise.resolve()

function reply(message: VideoMuxerResponse, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(message, transfer)
}

function teardown() {
  session?.audio?.cleanup()
  session = null
}

async function cancelOutput(current: Session | null) {
  if (current && current.output.state !== "canceled") {
    await current.output.cancel().catch(() => {})
  }
}

async function init(id: number, config: VideoMuxerConfig) {
  const { format, width, height, fps, keyFrameIntervalSec } = config
  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])

  const codec = await getFirstEncodableVideoCodec(preferred, {
    width,
    height,
    bitrate: QUALITY_HIGH,
  })
  // Not an error: the caller falls back to its own path (MediaRecorder for
  // WebM, a clear message for MP4) exactly as it did before the worker existed.
  if (!codec) {
    reply({ id, ok: true, type: "init", supported: false })
    return
  }

  const target = new BufferTarget()
  const outputFormat =
    format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat()
  const output = new Output({ format: outputFormat, target })
  const videoSource = new VideoSampleSource({
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: keyFrameIntervalSec,
  })
  output.addVideoTrack(videoSource, { frameRate: fps })

  // Best-effort: a clip with no usable audio still exports, silently. Must be
  // registered before `output.start()`.
  const audio = config.audio
    ? config.audio.segments
      ? await prepareAnimationAudio({
          source: config.audio.blob,
          format,
          outputFormat,
          segments: config.audio.segments,
          exportDurationSec: config.audio.durationSec,
          signal: aborter.signal,
        })
      : await prepareSourceAudio(
          config.audio.blob,
          format,
          outputFormat,
          config.audio.durationSec,
          aborter.signal
        )
    : null
  audio?.addToOutput(output)

  session = { output, target, videoSource, audio }
  await output.start()
  // Before the (much larger) video track, so the muxer doesn't buffer every
  // video packet waiting on the first audio one.
  await audio?.feed()
  reply({ id, ok: true, type: "init", supported: true })
}

async function handle(request: VideoMuxerRequest) {
  try {
    switch (request.type) {
      case "init": {
        await init(request.id, request.config)
        return
      }
      case "frame": {
        if (aborter.signal.aborted) throw new AnimationExportAbortedError()
        if (!session) throw new Error("Video mux worker was not initialized")
        const sample = new VideoSample(request.frame, {
          timestamp: request.timestampSec,
          duration: request.durationSec,
        })
        try {
          await session.videoSource.add(sample)
        } finally {
          sample.close()
        }
        reply({ id: request.id, ok: true, type: "frame" })
        return
      }
      case "finalize": {
        if (!session) throw new Error("Video mux worker was not initialized")
        await session.output.finalize()
        const buffer = session.target.buffer
        teardown()
        if (!buffer || buffer.byteLength === 0) {
          throw new Error("Video encode produced an empty file")
        }
        reply({ id: request.id, ok: true, type: "finalize", buffer }, [buffer])
        return
      }
      case "cancel": {
        const current = session
        teardown()
        await cancelOutput(current)
        reply({ id: request.id, ok: true, type: "cancel" })
        return
      }
    }
  } catch (err) {
    if (request.type === "frame") request.frame.close()
    const current = session
    teardown()
    await cancelOutput(current)
    reply({
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      aborted: err instanceof AnimationExportAbortedError,
    })
  }
}

self.onmessage = (event: MessageEvent<VideoMuxerRequest>) => {
  const request = event.data
  // Abort flips immediately rather than behind the queue, so frames already
  // waiting their turn are dropped instead of encoded.
  if (request.type === "init") aborter = new AbortController()
  if (request.type === "cancel") aborter.abort()
  queue = queue.then(() => handle(request))
}
