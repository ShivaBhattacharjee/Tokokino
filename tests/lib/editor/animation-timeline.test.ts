import { describe, expect, it } from "vitest"

import {
  DEFAULT_TIMELINE_MS,
  GHOST_SLOT_MS,
  MAX_DURATION_MS,
  TIMELINE_HEADROOM_MS,
  computeTicks,
  findGhostSlot,
  formatShort,
  formatTime,
  resolveDropStart,
  timelineEndFor,
} from "@/lib/editor/animation-timeline"
import type { AnimationClip } from "@/lib/editor/state-types"

const clip = (
  startMs: number,
  durationMs: number,
  id = `${startMs}`
): AnimationClip => ({
  id,
  startMs,
  durationMs,
})

describe("formatTime (mm:ss.cs)", () => {
  it("formats sub-second values with zero-padded minutes/seconds/centiseconds", () => {
    expect(formatTime(0)).toBe("00:00.00")
    expect(formatTime(50)).toBe("00:00.05")
    expect(formatTime(1234)).toBe("00:01.23")
  })

  it("rolls seconds into minutes", () => {
    expect(formatTime(61_000)).toBe("01:01.00")
    expect(formatTime(600_000)).toBe("10:00.00")
  })

  it("clamps negatives to zero", () => {
    expect(formatTime(-500)).toBe("00:00.00")
  })

  it("truncates rather than rounds centiseconds", () => {
    // 1999ms → 1s and 99cs (the remaining 9ms is dropped, not rounded up).
    expect(formatTime(1999)).toBe("00:01.99")
  })
})

describe("formatShort (mm:ss)", () => {
  it("drops the centisecond field", () => {
    expect(formatShort(0)).toBe("00:00")
    expect(formatShort(65_500)).toBe("01:05")
  })

  it("clamps negatives to zero", () => {
    expect(formatShort(-1)).toBe("00:00")
  })
})

describe("computeTicks", () => {
  it("uses a 1s step when zoomed in enough for it to be legible", () => {
    // 80px/s * 1s = 80 >= 48 → step 1s. rulerEnd 5s → ticks 0..5.
    expect(computeTicks(5000, 80)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("widens the step when zoomed out so ticks stay >= 48px apart", () => {
    // At 20px/s: 1s=20, 2s=40 (both <48), 5s=100 >=48 → step 5s.
    expect(computeTicks(20_000, 20)).toEqual([0, 5, 10, 15, 20])
  })

  it("caps the step at 60s when extremely zoomed out", () => {
    // Even 60s*0.5=30 < 48, but 60 is the largest option → step 60s.
    expect(computeTicks(180_000, 0.5)).toEqual([0, 60, 120, 180])
  })

  it("floors the tick count so a partial final interval is excluded", () => {
    // 5.9s of ruler at step 1s → last full second is 5.
    expect(computeTicks(5900, 80)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe("findGhostSlot", () => {
  it("centers the slot on the cursor in an empty timeline", () => {
    // cursor 5000, slot 1000 → start = 5000 - 500 = 4500.
    expect(findGhostSlot(5000, [], 10_000)).toBe(4500)
  })

  it("returns null when the cursor is over an existing clip", () => {
    expect(findGhostSlot(1500, [clip(1000, 1000)], 10_000)).toBeNull()
  })

  it("returns null when the cursor sits exactly on a clip boundary", () => {
    // cursorMs <= startMs + durationMs is treated as over the clip.
    expect(findGhostSlot(2000, [clip(1000, 1000)], 10_000)).toBeNull()
  })

  it("clamps the slot into the gap before the first clip", () => {
    // Gap is [0, 2000); cursor 1900 would center at 1400 but the slot must end
    // by 2000, so it clamps to 2000 - 1000 = 1000.
    expect(findGhostSlot(1900, [clip(2000, 2000)], 10_000)).toBe(1000)
  })

  it("clamps the slot against the left edge of a gap", () => {
    // Gap [3000, 10000); cursor 3100 would center at 2600 < gapStart → clamp 3000.
    expect(findGhostSlot(3100, [clip(0, 3000)], 10_000)).toBe(3000)
  })

  it("returns null when the surrounding gap is smaller than the slot", () => {
    // Gap between the two clips is [1000, 1500), only 500ms < 1000ms slot.
    const clips = [clip(0, 1000, "a"), clip(1500, 1000, "b")]
    expect(findGhostSlot(1250, clips, 10_000)).toBeNull()
  })

  it("finds a gap between two clips when it is wide enough", () => {
    const clips = [clip(0, 1000, "a"), clip(5000, 1000, "b")]
    // Gap [1000, 5000); cursor 3000 centers at 2500.
    expect(findGhostSlot(3000, clips, 10_000)).toBe(2500)
  })

  it("respects an unsorted clip list", () => {
    const clips = [clip(5000, 1000, "b"), clip(0, 1000, "a")]
    expect(findGhostSlot(3000, clips, 10_000)).toBe(2500)
  })

  it("honors a custom slot width", () => {
    // 2000ms slot centered on cursor 5000 → start 4000.
    expect(findGhostSlot(5000, [], 10_000, 2000)).toBe(4000)
  })

  it("uses the default GHOST_SLOT_MS width", () => {
    const withDefault = findGhostSlot(5000, [], 10_000)
    const withExplicit = findGhostSlot(5000, [], 10_000, GHOST_SLOT_MS)
    expect(withDefault).toBe(withExplicit)
  })
})

describe("timelineEndFor — dynamic length, no 1-minute cap", () => {
  it("floors at the default length for a short animation", () => {
    // A 5s animation with no clips keeps the default (60s) track, not a sliver.
    expect(timelineEndFor(5000, 0)).toBe(DEFAULT_TIMELINE_MS)
  })

  it("grows past the old 60s cap for a long animation (+ headroom)", () => {
    // 2 minutes — well beyond the removed 1-minute cap.
    const twoMin = 120_000
    expect(timelineEndFor(twoMin, 0)).toBe(twoMin + TIMELINE_HEADROOM_MS)
  })

  it("extends to cover a clip that sits past the set duration", () => {
    // Duration is short but a clip lives far out — the track reaches the clip.
    const lastClipEnd = 200_000
    expect(timelineEndFor(5000, lastClipEnd)).toBe(
      lastClipEnd + TIMELINE_HEADROOM_MS
    )
  })

  it("never exceeds the hard ceiling", () => {
    expect(timelineEndFor(MAX_DURATION_MS * 2, 0)).toBe(MAX_DURATION_MS)
  })
})

describe("resolveDropStart", () => {
  it("keeps the dropped position when it fits", () => {
    expect(resolveDropStart(3000, 1000, [], 10_000, 0)).toBe(3000)
  })

  it("clamps a drop past the timeline end back to maxStart", () => {
    // maxStart = 10000 - 1000 = 9000; dropped 9500 doesn't fit, candidate 9000 wins.
    expect(resolveDropStart(9500, 1000, [], 10_000, 0)).toBe(9000)
  })

  it("clamps a negative drop to zero", () => {
    expect(resolveDropStart(-500, 1000, [], 10_000, 0)).toBe(0)
  })

  it("snaps flush after a neighbour when the drop overlaps it", () => {
    const others = [clip(2000, 2000)] // occupies [2000, 4000)
    // Drop at 2500 overlaps; nearest free flush spot is the neighbour end 4000.
    expect(resolveDropStart(2500, 1000, others, 10_000, 0)).toBe(4000)
  })

  it("snaps flush before a neighbour when that is nearer to the drop", () => {
    const others = [clip(4000, 2000)] // occupies [4000, 6000)
    // Drop at 3800 overlaps; candidate startMs - dur = 4000 - 1000 = 3000 fits
    // and is nearest to 3800.
    expect(resolveDropStart(3800, 1000, others, 10_000, 0)).toBe(3000)
  })

  it("snaps into the only free gap when the drop overlaps a neighbour", () => {
    const others = [clip(0, 3000, "a"), clip(4000, 6000, "b")]
    // Only free gap is [3000, 4000), exactly one slot wide. Drop at 3500 overlaps
    // clip b, so it snaps flush to the single valid start, 3000.
    expect(resolveDropStart(3500, 1000, others, 10_000, 3000)).toBe(3000)
  })

  it("returns the original start when the drop cannot be resolved anywhere", () => {
    // A neighbour fully blocks the timeline; only originalStart is a valid island.
    const others = [clip(0, 10_000)]
    // dur 1000, maxStart 9000, but everything overlaps → fallback originalStart.
    expect(resolveDropStart(5000, 1000, others, 10_000, 500)).toBe(500)
  })
})
