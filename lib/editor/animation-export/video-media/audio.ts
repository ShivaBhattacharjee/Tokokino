/**
 * Source-clip audio for the video-media export.
 *
 * MP4/WebM carry the source clip's audio when present: remux (passthrough) when
 * the codec fits the container, otherwise re-encode to AAC (MP4) or Opus (WebM).
 * GIF has no audio track by nature.
 */

import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Input,
  QUALITY_HIGH,
  getFirstEncodableAudioCodec,
  type AudioCodec,
  type Mp4OutputFormat,
  type Output,
  type WebMOutputFormat,
} from "mediabunny"

import { throwIfAborted } from "../utils"

/**
 * Preferred audio codecs for an export container, in preference order.
 * Used when the source codec can't be remuxed and we must re-encode.
 */
export function preferredAudioCodecs(format: "mp4" | "webm"): AudioCodec[] {
  return format === "mp4"
    ? (["aac", "mp3"] as AudioCodec[])
    : (["opus", "vorbis"] as AudioCodec[])
}

/** True when `codec` can be copied into the container without re-encoding. */
export function canRemuxAudioCodec(
  codec: AudioCodec,
  supported: readonly AudioCodec[]
): boolean {
  return supported.includes(codec)
}

/**
 * How to carry source audio into an MP4/WebM export.
 * - remux: copy packets as-is (source codec fits the container)
 * - reencode: decode + encode to a container-friendly codec
 * - skip: no usable audio (silent video)
 */
export type AudioMuxStrategy =
  | { kind: "remux"; codec: AudioCodec }
  | { kind: "reencode"; candidates: AudioCodec[] }
  | { kind: "skip" }

/** Decide remux vs re-encode vs skip from track metadata + container support. */
export function resolveAudioMuxStrategy(
  sourceCodec: AudioCodec | null,
  format: "mp4" | "webm",
  supported: readonly AudioCodec[],
  canDecode: boolean
): AudioMuxStrategy {
  if (!sourceCodec) return { kind: "skip" }
  if (canRemuxAudioCodec(sourceCodec, supported)) {
    return { kind: "remux", codec: sourceCodec }
  }
  if (!canDecode) return { kind: "skip" }
  const candidates = preferredAudioCodecs(format).filter((c) =>
    supported.includes(c)
  )
  if (candidates.length === 0) return { kind: "skip" }
  return { kind: "reencode", candidates }
}

/**
 * Whether a remuxed packet belongs in the export.
 *
 * Source clips often carry packets with negative timestamps (AAC encoder delay /
 * edit-list priming). Mediabunny's muxer rejects those, and they must not be
 * presented anyway — skip them. Also drop packets that start at/after the video
 * end so audio doesn't outlast the styled frames.
 */
export function shouldIncludeAudioPacket(
  packetTimestamp: number,
  durationSec: number
): boolean {
  return packetTimestamp >= 0 && packetTimestamp < Math.max(0, durationSec)
}

/** Audio window length matching the exported video track (frameCount / fps). */
export function exportAudioDurationSec(plan: {
  frameCount: number
  frameDurationSec: number
}): number {
  return plan.frameCount * plan.frameDurationSec
}

export type SourceAudioFeed = {
  /** Register the audio track on the output (must run before `output.start()`). */
  addToOutput: (output: Output) => void
  /** Stream packets/samples after `output.start()`. Audio first keeps mux memory low. */
  feed: () => Promise<void>
  cleanup: () => void
}

/**
 * Open the source clip and prepare an audio track for MP4/WebM export.
 *
 * Remuxes when the source codec is supported by the container; otherwise
 * re-encodes (AAC/MP3 for MP4, Opus/Vorbis for WebM). Returns null when the
 * clip has no audio, or when neither remux nor re-encode is possible — the
 * video export still proceeds silently.
 */
export async function prepareSourceAudio(
  src: string,
  format: "mp4" | "webm",
  outputFormat: Mp4OutputFormat | WebMOutputFormat,
  durationSec: number,
  signal?: AbortSignal
): Promise<SourceAudioFeed | null> {
  let input: Input | null = null
  try {
    throwIfAborted(signal)
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryAudioTrack()
    if (!track) {
      input.dispose()
      return null
    }
    const codec = await track.getCodec()
    if (!codec) {
      input.dispose()
      return null
    }

    const supported = outputFormat.getSupportedAudioCodecs()
    const endSec = Math.max(0, durationSec)
    const boundInput = input

    // Remux / passthrough — no decode, best quality, works even when WebCodecs
    // can't decode the audio (as long as the packets are readable).
    if (canRemuxAudioCodec(codec, supported)) {
      const audioSource = new EncodedAudioPacketSource(codec)
      const decoderConfig = await track.getDecoderConfig()
      return {
        addToOutput: (output) => {
          output.addAudioTrack(audioSource)
        },
        feed: async () => {
          const sink = new EncodedPacketSink(track)
          let first = true
          for await (const packet of sink.packets()) {
            throwIfAborted(signal)
            // Past the video end → done. Negative priming packets → skip and
            // keep going (breaking here would drop the entire audio track).
            if (packet.timestamp >= endSec) break
            if (!shouldIncludeAudioPacket(packet.timestamp, endSec)) continue
            await audioSource.add(
              packet,
              first && decoderConfig ? { decoderConfig } : undefined
            )
            first = false
          }
        },
        cleanup: () => boundInput.dispose(),
      }
    }

    // Re-encode — container doesn't accept the source codec (e.g. AAC → WebM).
    const canDecode = await track.canDecode()
    const strategy = resolveAudioMuxStrategy(
      codec,
      format,
      supported,
      canDecode
    )
    if (strategy.kind !== "reencode") {
      input.dispose()
      return null
    }
    const numberOfChannels = await track.getNumberOfChannels()
    const sampleRate = await track.getSampleRate()
    const encodable = await getFirstEncodableAudioCodec(strategy.candidates, {
      numberOfChannels,
      sampleRate,
      bitrate: QUALITY_HIGH,
    })
    if (!encodable) {
      input.dispose()
      return null
    }
    const audioSource = new AudioSampleSource({
      codec: encodable,
      bitrate: QUALITY_HIGH,
    })
    return {
      addToOutput: (output) => {
        output.addAudioTrack(audioSource)
      },
      feed: async () => {
        const sink = new AudioSampleSink(track)
        for await (const sample of sink.samples(0, endSec)) {
          throwIfAborted(signal)
          // Same priming-delay case as remux: muxer rejects negative timestamps.
          if (sample.timestamp < 0) {
            sample.close()
            continue
          }
          try {
            await audioSource.add(sample)
          } finally {
            sample.close()
          }
        }
      },
      cleanup: () => boundInput.dispose(),
    }
  } catch {
    input?.dispose()
    return null
  }
}
