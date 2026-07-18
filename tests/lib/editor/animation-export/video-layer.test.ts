import { describe, expect, it } from "vitest"

import {
  resolveVideoSegments,
  resolveVideoSourceTimeMs,
} from "@/lib/editor/animation-export/video-layer"
import type { VideoTimelineClip } from "@/lib/editor/state-types"

const DURATION = 10_000

describe("resolveVideoSegments", () => {
  it("uses one full-source segment when no timeline clips exist", () => {
    expect(resolveVideoSegments([], DURATION)).toEqual([
      {
        sourceStartMs: 0,
        sourceEndMs: DURATION,
        timelineStartMs: 0,
      },
    ])
  })

  it("clamps invalid trim and timeline values to the source bounds", () => {
    const clips: VideoTimelineClip[] = [
      {
        id: "invalid",
        timelineStartMs: -500,
        startMs: -1_000,
        endMs: 30_000,
      },
    ]

    expect(resolveVideoSegments(clips, DURATION)).toEqual([
      {
        sourceStartMs: 0,
        sourceEndMs: DURATION,
        timelineStartMs: 0,
      },
    ])
  })

  it("keeps split timeline clips independent after normalization", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 7_000, endMs: 12_000 },
      { id: "b", timelineStartMs: 3_000, startMs: 1_000, endMs: 3_000 },
    ]

    expect(resolveVideoSegments(clips, DURATION)).toEqual([
      { sourceStartMs: 7_000, sourceEndMs: DURATION, timelineStartMs: 0 },
      { sourceStartMs: 1_000, sourceEndMs: 3_000, timelineStartMs: 3_000 },
    ])
  })
})

describe("resolveVideoSourceTimeMs", () => {
  it("plays the whole source when no clips are set", () => {
    expect(resolveVideoSourceTimeMs([], 0, DURATION)).toBe(0)
    expect(resolveVideoSourceTimeMs([], 4_000, DURATION)).toBe(4_000)
  })

  it("offsets into the source by the clip's trim start", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 2_000, endMs: 6_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 0, DURATION)).toBe(2_000)
    expect(resolveVideoSourceTimeMs(clips, 1_500, DURATION)).toBe(3_500)
  })

  it("holds the last frame past the clip's end", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 0, endMs: 3_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 2_999, DURATION)).toBe(2_999)
    expect(resolveVideoSourceTimeMs(clips, 3_000, DURATION)).toBeNull()
  })

  it("holds before a clip that starts later on the timeline", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 5_000, startMs: 0, endMs: 2_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 4_999, DURATION)).toBeNull()
    expect(resolveVideoSourceTimeMs(clips, 5_000, DURATION)).toBe(0)
    expect(resolveVideoSourceTimeMs(clips, 6_000, DURATION)).toBe(1_000)
  })

  it("maps each split clip back to its own slice of the source", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 6_000, endMs: 8_000 },
      { id: "b", timelineStartMs: 2_000, startMs: 1_000, endMs: 3_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 500, DURATION)).toBe(6_500)
    expect(resolveVideoSourceTimeMs(clips, 2_500, DURATION)).toBe(1_500)
  })

  it("clamps trims that outlast the source", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 0, endMs: 30_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 9_999, DURATION)).toBe(9_999)
    expect(resolveVideoSourceTimeMs(clips, 12_000, DURATION)).toBeNull()
  })

  it("falls back to the trim start when a clip has no timeline position", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", startMs: 3_000, endMs: 5_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 3_000, DURATION)).toBe(3_000)
    expect(resolveVideoSourceTimeMs(clips, 2_999, DURATION)).toBeNull()
  })
})
