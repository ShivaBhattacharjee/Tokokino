/**
 * Audio for the keyframe (Animate-mode) export.
 *
 * The video-media export can stream the source's audio straight through (see
 * `video-media/audio.ts`), because that
 * export plays the clip start-to-finish: packet timestamps already line up with
 * the output. The animation timeline doesn't guarantee that — the clip can be
 * trimmed, shifted to start later, or split into pieces that play out of source
 * order — so audio has to be re-timed onto the same segments the frames use
 * (`resolveVideoSegments`), which means decoding and re-encoding it.
 *
 * The untouched-timeline case is still handed to `prepareSourceAudio`, so the
 * common export keeps passthrough quality and still works when WebCodecs can't
 * decode the audio (remux only needs readable packets).
 */

import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  Input,
  QUALITY_HIGH,
  getFirstEncodableAudioCodec,
  type Mp4OutputFormat,
  type WebMOutputFormat,
} from "mediabunny"

import { throwIfAborted } from "./utils"
import type { VideoSegment } from "./video-layer"
import {
  preferredAudioCodecs,
  prepareSourceAudio,
  type SourceAudioFeed,
} from "./video-media/audio"

/**
 * True when the timeline plays the source from its start at position zero, so
 * source time and export time agree and no re-timing is needed. An end trim
 * still counts: the caller caps the audio window with `durationSec`.
 */
export function isUntouchedTimeline(
  segments: readonly VideoSegment[]
): boolean {
  const only = segments.length === 1 ? segments[0] : null
  return !!only && only.timelineStartMs === 0 && only.sourceStartMs === 0
}

/**
 * Audio window for the export: the animation's own length, but never past where
 * the clip's last segment stops playing — otherwise a short clip on a long
 * timeline would keep playing audio over frames it isn't in.
 */
export function audioWindowSec(
  segments: readonly VideoSegment[],
  exportDurationSec: number
): number {
  const lastPlayedMs = segments.reduce(
    (max, segment) =>
      Math.max(
        max,
        segment.timelineStartMs + (segment.sourceEndMs - segment.sourceStartMs)
      ),
    0
  )
  return Math.max(0, Math.min(exportDurationSec, lastPlayedMs / 1000))
}

/**
 * Prepare the source clip's audio, re-timed onto the animation timeline.
 * Returns null when the clip is silent or its audio can't be carried across —
 * the export then proceeds silently rather than failing.
 */
export async function prepareAnimationAudio({
  src,
  format,
  outputFormat,
  segments,
  exportDurationSec,
  signal,
}: {
  src: string
  format: "mp4" | "webm"
  outputFormat: Mp4OutputFormat | WebMOutputFormat
  segments: readonly VideoSegment[]
  exportDurationSec: number
  signal?: AbortSignal
}): Promise<SourceAudioFeed | null> {
  const windowSec = audioWindowSec(segments, exportDurationSec)
  if (windowSec <= 0) return null

  if (isUntouchedTimeline(segments)) {
    return prepareSourceAudio(src, format, outputFormat, windowSec, signal)
  }

  let input: Input | null = null
  try {
    throwIfAborted(signal)
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) })
    const track = await input.getPrimaryAudioTrack()
    // Re-timing means re-encoding, so unlike the passthrough path this needs the
    // audio to be decodable here.
    if (!track || !(await track.canDecode())) {
      input.dispose()
      return null
    }

    const supported = outputFormat.getSupportedAudioCodecs()
    const candidates = preferredAudioCodecs(format).filter((c) =>
      supported.includes(c)
    )
    if (candidates.length === 0) {
      input.dispose()
      return null
    }
    const numberOfChannels = await track.getNumberOfChannels()
    const sampleRate = await track.getSampleRate()
    const encodable = await getFirstEncodableAudioCodec(candidates, {
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
    const boundInput = input
    // Timeline order, not source order: the muxer needs non-decreasing
    // timestamps, and split clips can be rearranged on the timeline.
    const ordered = [...segments].sort(
      (a, b) => a.timelineStartMs - b.timelineStartMs
    )

    return {
      addToOutput: (output) => {
        output.addAudioTrack(audioSource)
      },
      feed: async () => {
        const sink = new AudioSampleSink(track)
        for (const segment of ordered) {
          const startSec = segment.sourceStartMs / 1000
          const endSec = segment.sourceEndMs / 1000
          if (endSec <= startSec) continue
          const shiftSec =
            (segment.timelineStartMs - segment.sourceStartMs) / 1000
          for await (const sample of sink.samples(startSec, endSec)) {
            throwIfAborted(signal)
            const at = sample.timestamp + shiftSec
            // Muxer rejects negative timestamps, and nothing past the window is
            // presented anyway.
            if (at < 0 || at >= windowSec) {
              sample.close()
              continue
            }
            try {
              sample.setTimestamp(at)
              await audioSource.add(sample)
            } finally {
              sample.close()
            }
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
