import { describe, expect, it } from "vitest"

import {
  audioWindowSec,
  isUntouchedTimeline,
} from "@/lib/editor/animation-export/animation-audio"
import { resolveVideoSegments } from "@/lib/editor/animation-export/video-layer"

const DURATION = 10_000

describe("isUntouchedTimeline", () => {
  it("is true when the clip plays from its start at position zero", () => {
    const segments = resolveVideoSegments([], DURATION)
    expect(isUntouchedTimeline(segments)).toBe(true)
  })

  it("stays true for an end-only trim (the window caps it)", () => {
    const segments = resolveVideoSegments(
      [{ id: "a", timelineStartMs: 0, startMs: 0, endMs: 4_000 }],
      DURATION
    )
    expect(isUntouchedTimeline(segments)).toBe(true)
  })

  it("is false once the clip is trimmed at the start", () => {
    const segments = resolveVideoSegments(
      [{ id: "a", timelineStartMs: 0, startMs: 2_000, endMs: 6_000 }],
      DURATION
    )
    expect(isUntouchedTimeline(segments)).toBe(false)
  })

  it("is false once the clip is shifted later on the timeline", () => {
    const segments = resolveVideoSegments(
      [{ id: "a", timelineStartMs: 1_000, startMs: 0, endMs: 6_000 }],
      DURATION
    )
    expect(isUntouchedTimeline(segments)).toBe(false)
  })

  it("is false for a split clip", () => {
    const segments = resolveVideoSegments(
      [
        { id: "a", timelineStartMs: 0, startMs: 0, endMs: 2_000 },
        { id: "b", timelineStartMs: 2_000, startMs: 5_000, endMs: 7_000 },
      ],
      DURATION
    )
    expect(isUntouchedTimeline(segments)).toBe(false)
  })
})

describe("audioWindowSec", () => {
  it("stops audio where the clip stops playing, not at the timeline end", () => {
    const segments = resolveVideoSegments(
      [{ id: "a", timelineStartMs: 0, startMs: 0, endMs: 3_000 }],
      DURATION
    )
    expect(audioWindowSec(segments, 8)).toBe(3)
  })

  it("cuts audio at the timeline end when the clip outlasts it", () => {
    const segments = resolveVideoSegments([], DURATION)
    expect(audioWindowSec(segments, 4)).toBe(4)
  })

  it("accounts for a clip shifted later on the timeline", () => {
    const segments = resolveVideoSegments(
      [{ id: "a", timelineStartMs: 5_000, startMs: 0, endMs: 2_000 }],
      DURATION
    )
    expect(audioWindowSec(segments, 30)).toBe(7)
  })

  it("extends to the last of several split segments", () => {
    const segments = resolveVideoSegments(
      [
        { id: "a", timelineStartMs: 0, startMs: 0, endMs: 2_000 },
        { id: "b", timelineStartMs: 2_000, startMs: 8_000, endMs: 9_500 },
      ],
      DURATION
    )
    expect(audioWindowSec(segments, 30)).toBe(3.5)
  })

  it("is zero when nothing plays", () => {
    expect(audioWindowSec([], 10)).toBe(0)
  })
})
