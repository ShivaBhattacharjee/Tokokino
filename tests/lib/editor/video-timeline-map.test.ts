import { describe, expect, it } from "vitest"

import { sourceTimeAt, videoClipAtTime } from "@/lib/editor/video-timeline-map"
import type { VideoTimelineClip } from "@/lib/editor/state-types"

/**
 * Timeline time and source time only agree for an untrimmed clip parked at
 * zero. The animate player and the crop dialog both map between them, and they
 * have to agree — otherwise the crop handles land on a different frame than the
 * canvas plays.
 */
const clip = (over: Partial<VideoTimelineClip> = {}): VideoTimelineClip => ({
  id: "v1",
  timelineStartMs: 0,
  startMs: 0,
  endMs: null,
  ...over,
})

describe("videoClipAtTime", () => {
  it("treats a missing timeline as one untrimmed clip over the source", () => {
    expect(videoClipAtTime(null, 6090, 7100)?.id).toBe("video-main")
    expect(videoClipAtTime([], 6090, 7100)?.id).toBe("video-main")
  })

  it("finds the clip covering the time", () => {
    const clips = [
      clip({ id: "a", timelineStartMs: 0, startMs: 0, endMs: 2000 }),
      clip({ id: "b", timelineStartMs: 2000, startMs: 5000, endMs: 7000 }),
    ]
    expect(videoClipAtTime(clips, 500)?.id).toBe("a")
    expect(videoClipAtTime(clips, 2500)?.id).toBe("b")
  })

  it("returns undefined in a gap between clips", () => {
    const clips = [
      clip({ id: "a", timelineStartMs: 0, startMs: 0, endMs: 1000 }),
      clip({ id: "b", timelineStartMs: 5000, startMs: 0, endMs: 1000 }),
    ]
    expect(videoClipAtTime(clips, 3000)).toBeUndefined()
  })

  it("is half-open — a clip's own end belongs to the next clip", () => {
    const clips = [
      clip({ id: "a", timelineStartMs: 0, startMs: 0, endMs: 2000 }),
      clip({ id: "b", timelineStartMs: 2000, startMs: 0, endMs: 2000 }),
    ]
    expect(videoClipAtTime(clips, 2000)?.id).toBe("b")
  })
})

describe("sourceTimeAt", () => {
  it("passes the time straight through for an untrimmed clip at zero", () => {
    expect(sourceTimeAt(null, 6090, 7.1)).toBeCloseTo(6.09, 5)
  })

  it("offsets by the clip's trim — the whole point of the mapping", () => {
    // Plays source 5s..7s while sitting at 2s..4s on the timeline, so timeline
    // 3s is source 6s.
    const clips = [clip({ timelineStartMs: 2000, startMs: 5000, endMs: 7000 })]
    expect(sourceTimeAt(clips, 3000, 7.1)).toBeCloseTo(6, 5)
  })

  it("returns null in a gap, so callers can fall back", () => {
    const clips = [clip({ timelineStartMs: 0, startMs: 0, endMs: 1000 })]
    expect(sourceTimeAt(clips, 4000, 7.1)).toBeNull()
  })

  it("has no source time past the end of the media", () => {
    expect(sourceTimeAt(null, 999_000, 7.1)).toBeNull()
  })

  it("clamps when a clip's end overruns the real media duration", () => {
    // Stale/optimistic endMs (metadata said longer than the file really is).
    const clips = [clip({ timelineStartMs: 0, startMs: 0, endMs: 60_000 })]
    expect(sourceTimeAt(clips, 8000, 7.1)).toBeCloseTo(7.1, 5)
  })

  it("leaves the time unclamped when the duration is not known yet", () => {
    expect(sourceTimeAt(null, 6090)).toBeCloseTo(6.09, 5)
    expect(sourceTimeAt(null, 6090, Number.NaN)).toBeCloseTo(6.09, 5)
  })
})
