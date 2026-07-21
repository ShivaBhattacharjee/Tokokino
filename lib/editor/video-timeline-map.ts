import type { VideoTimelineClip } from "./state-types"

/**
 * Timeline time → source-media time.
 *
 * A video clip can start anywhere on the timeline (`timelineStartMs`) and play
 * from anywhere inside the source (`startMs`), so the two clocks only agree for
 * an untrimmed clip parked at zero. Both the animate player (seeking the live
 * <video> each frame) and the crop dialog (decoding a still poster) need this
 * mapping, and they must agree or the crop handles land on a different frame
 * than the canvas shows.
 */

/** The default timeline: one untrimmed clip covering the whole source. */
const WHOLE_SOURCE: VideoTimelineClip[] = [
  { id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null },
]

/** The clip playing at timeline time `ms`, or undefined in a gap. */
export function videoClipAtTime(
  clips: readonly VideoTimelineClip[] | null | undefined,
  ms: number,
  mediaDurationMs?: number
): VideoTimelineClip | undefined {
  const list = clips && clips.length > 0 ? clips : WHOLE_SOURCE
  return list.find(
    (clip) =>
      ms >= (clip.timelineStartMs ?? clip.startMs) &&
      ms <
        (clip.timelineStartMs ?? clip.startMs) +
          ((clip.endMs ?? mediaDurationMs ?? Infinity) - clip.startMs)
  )
}

/**
 * The source-media SECONDS shown at timeline time `ms`, or null when no clip
 * covers it. Clamped to `mediaDurationSec` when that is known.
 */
export function sourceTimeAt(
  clips: readonly VideoTimelineClip[] | null | undefined,
  ms: number,
  mediaDurationSec?: number
): number | null {
  const mediaDurationMs =
    mediaDurationSec != null && Number.isFinite(mediaDurationSec)
      ? mediaDurationSec * 1000
      : undefined
  const clip = videoClipAtTime(clips, ms, mediaDurationMs)
  if (!clip) return null
  const sourceMs = clip.startMs + (ms - (clip.timelineStartMs ?? clip.startMs))
  const seconds = sourceMs / 1000
  return mediaDurationSec != null && Number.isFinite(mediaDurationSec)
    ? Math.min(seconds, mediaDurationSec)
    : seconds
}
