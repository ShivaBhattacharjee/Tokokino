import { describe, expect, it } from "vitest"

import {
  activeClipAt,
  backgroundsDiffer,
  borderBetween,
  bordersDiffer,
  clipAffectsMain,
  clipAffectsSlot,
  clipTargetOf,
  clipsProgressAt,
  DEFAULT_BASELINE,
  EMPTY_FILTER_STACK,
  filtersDiffer,
  INVISIBLE_BORDER,
  lerp,
  resolveAnimateFilterStack,
  sampleKeyframes,
  shadowsDiffer,
} from "@/lib/editor/animation-playback"
import type {
  AnimationClip,
  AssetFilter,
  Background,
  Border,
  ClipBaseline,
  Shadow,
} from "@/lib/editor/state-types"

// easeOut(t) = 1 - (1 - t)^3; easeOut(0.5) = 0.875.
const EASED_HALF = 0.875

const baseline = (over: Partial<ClipBaseline>): ClipBaseline => ({
  ...DEFAULT_BASELINE,
  ...over,
})

const clip = (
  over: Partial<AnimationClip> & { id: string }
): AnimationClip => ({
  startMs: 0,
  durationMs: 1000,
  ...over,
})

const filterClip = (
  id: string,
  startMs: number,
  fromFilter: AssetFilter,
  toFilter: AssetFilter
): AnimationClip =>
  clip({
    id,
    startMs,
    effects: ["filter"],
    baseline: baseline({ filter: fromFilter }),
    pose: baseline({ filter: toFilter }),
  })

describe("lerp", () => {
  it("interpolates linearly between endpoints", () => {
    expect(lerp(0, 100, 0)).toBe(0)
    expect(lerp(0, 100, 1)).toBe(100)
    expect(lerp(10, 20, 0.5)).toBe(15)
    expect(lerp(0, 100, EASED_HALF)).toBe(87.5)
  })
})

describe("filtersDiffer", () => {
  it("is a plain inequality between filter ids", () => {
    expect(filtersDiffer("none", "none")).toBe(false)
    expect(filtersDiffer("vivid", "vivid")).toBe(false)
    expect(filtersDiffer("none", "vivid")).toBe(true)
  })
})

describe("clipTargetOf", () => {
  it("defaults legacy clips (no target) to the whole canvas", () => {
    expect(clipTargetOf(clip({ id: "a" }))).toEqual({ scope: "all" })
  })

  it("passes an explicit target through", () => {
    const target = { scope: "slot", slotId: "s1" } as const
    expect(clipTargetOf(clip({ id: "a", target }))).toEqual(target)
  })
})

describe("clipAffectsMain / clipAffectsSlot", () => {
  it("an 'all' clip affects the main screenshot and every slot", () => {
    const c = clip({ id: "a" }) // legacy → scope all
    expect(clipAffectsMain(c)).toBe(true)
    expect(clipAffectsSlot(c, "s1")).toBe(true)
  })

  it("a 'main' clip affects only the main screenshot", () => {
    const c = clip({ id: "a", target: { scope: "main" } })
    expect(clipAffectsMain(c)).toBe(true)
    expect(clipAffectsSlot(c, "s1")).toBe(false)
  })

  it("a 'slot' clip affects only its own slot", () => {
    const c = clip({ id: "a", target: { scope: "slot", slotId: "s1" } })
    expect(clipAffectsMain(c)).toBe(false)
    expect(clipAffectsSlot(c, "s1")).toBe(true)
    expect(clipAffectsSlot(c, "s2")).toBe(false)
  })
})

describe("clipsProgressAt", () => {
  const clips = [clip({ id: "a", startMs: 1000, durationMs: 1000 })]

  it("holds full pose (1) when there are no clips", () => {
    expect(clipsProgressAt([], 500)).toBe(1)
  })

  it("is 0 before the first clip starts", () => {
    expect(clipsProgressAt(clips, 0)).toBe(0)
  })

  it("eases inside the clip", () => {
    expect(clipsProgressAt(clips, 1500)).toBeCloseTo(EASED_HALF, 5)
  })

  it("holds the pose (1) after the clip and in trailing gaps", () => {
    expect(clipsProgressAt(clips, 5000)).toBe(1)
  })

  it("holds the pose (1) in a gap that follows an earlier clip", () => {
    const two = [
      clip({ id: "a", startMs: 0, durationMs: 1000 }),
      clip({ id: "b", startMs: 4000, durationMs: 1000 }),
    ]
    expect(clipsProgressAt(two, 2000)).toBe(1)
  })
})

describe("activeClipAt", () => {
  const a = clip({ id: "a", startMs: 1000, durationMs: 1000 })
  const b = clip({ id: "b", startMs: 4000, durationMs: 1000 })

  it("returns null with no clips", () => {
    expect(activeClipAt([], 0)).toBeNull()
  })

  it("before the first clip holds it at progress 0 and flags isFirst", () => {
    const r = activeClipAt([a, b], 0)!
    expect(r.clip.id).toBe("a")
    expect(r.progress).toBe(0)
    expect(r.isFirst).toBe(true)
    expect(r.prev).toBeNull()
    expect(r.next?.id).toBe("b")
  })

  it("inside a clip returns its eased progress and neighbours", () => {
    const r = activeClipAt([a, b], 1500)!
    expect(r.clip.id).toBe("a")
    expect(r.progress).toBeCloseTo(EASED_HALF, 5)
    expect(r.next?.id).toBe("b")
  })

  it("in a gap holds the preceding clip at progress 1", () => {
    const r = activeClipAt([a, b], 3000)!
    expect(r.clip.id).toBe("a")
    expect(r.progress).toBe(1)
    expect(r.isFirst).toBe(true)
  })

  it("past the last clip holds it at progress 1", () => {
    const r = activeClipAt([a, b], 9000)!
    expect(r.clip.id).toBe("b")
    expect(r.progress).toBe(1)
    expect(r.isFirst).toBe(false)
    expect(r.prev?.id).toBe("a")
  })
})

describe("sampleKeyframes", () => {
  const num = (from: number, to: number, p: number) => lerp(from, to, p)
  const frames = [
    { startMs: 0, durationMs: 1000, value: 10 },
    { startMs: 3000, durationMs: 1000, value: 20 },
  ]

  it("returns null when there are no frames", () => {
    expect(sampleKeyframes([], 100, 0, num)).toBeNull()
  })

  it("returns the rest value before the first frame", () => {
    const early = [{ startMs: 500, durationMs: 1000, value: 10 }]
    expect(sampleKeyframes(early, 0, 3, num)).toBe(3)
  })

  it("eases from rest into the first frame", () => {
    // At 500ms of a [0,1000] frame: from rest 0 → 10 at easeOut(0.5)=0.875.
    expect(sampleKeyframes(frames, 500, 0, num)).toBeCloseTo(8.75, 5)
  })

  it("holds the previous frame's value across a gap", () => {
    expect(sampleKeyframes(frames, 2000, 0, num)).toBe(10)
  })

  it("holds the last frame's value past the end", () => {
    expect(sampleKeyframes(frames, 9000, 0, num)).toBe(20)
  })
})

describe("resolveAnimateFilterStack", () => {
  it("is empty when no clip animates a filter", () => {
    const plain = clip({ id: "a", effects: ["zoom"] })
    expect(resolveAnimateFilterStack([plain], "vivid", null)).toBe(
      EMPTY_FILTER_STACK
    )
  })

  it("builds base from the first clip's FROM filter and layers from poses", () => {
    const clips = [
      filterClip("a", 0, "none", "vivid"),
      filterClip("b", 2000, "vivid", "noir"),
    ]
    const stack = resolveAnimateFilterStack(clips, "warm", null)
    expect(stack.base).toBe("none")
    expect(stack.layers.map((l) => l.filter)).toEqual(["vivid", "noir"])
  })

  it("uses the committed filter for the selected clip's layer", () => {
    const clips = [filterClip("a", 0, "none", "vivid")]
    const stack = resolveAnimateFilterStack(clips, "warm", "a")
    expect(stack.layers[0].filter).toBe("warm")
  })

  it("marks layers up to the selected clip opaque at rest", () => {
    const clips = [
      filterClip("a", 0, "none", "vivid"),
      filterClip("b", 2000, "vivid", "noir"),
    ]
    const selectFirst = resolveAnimateFilterStack(clips, "vivid", "a")
    expect(selectFirst.layers.map((l) => l.restOpaque)).toEqual([true, false])

    // With nothing selected, every layer is opaque at rest (shows last keyframe).
    const none = resolveAnimateFilterStack(clips, "vivid", null)
    expect(none.layers.map((l) => l.restOpaque)).toEqual([true, true])
  })

  it("sorts clips chronologically before stacking", () => {
    const clips = [
      filterClip("b", 4000, "vivid", "noir"),
      filterClip("a", 0, "none", "vivid"),
    ]
    const stack = resolveAnimateFilterStack(clips, "warm", null)
    expect(stack.layers.map((l) => l.id)).toEqual(["a", "b"])
  })
})

describe("shadowsDiffer", () => {
  const shadow = (over: Partial<Shadow>): Shadow => ({
    type: "drop",
    intensity: 50,
    color: "#000000",
    lightSource: "center",
    ...over,
  })

  it("treats two invisible shadows as equal even with different inert fields", () => {
    const a = shadow({ type: "none", intensity: 80 })
    const b = shadow({ type: "none", intensity: 10, color: "#ffffff" })
    expect(shadowsDiffer(a, b)).toBe(false)
  })

  it("treats zero-intensity as invisible", () => {
    expect(
      shadowsDiffer(shadow({ intensity: 0 }), shadow({ type: "none" }))
    ).toBe(false)
  })

  it("detects a real change between two visible shadows", () => {
    expect(
      shadowsDiffer(shadow({ intensity: 50 }), shadow({ intensity: 90 }))
    ).toBe(true)
    expect(
      shadowsDiffer(shadow({ type: "drop" }), shadow({ type: "soft" }))
    ).toBe(true)
  })
})

describe("bordersDiffer / borderBetween", () => {
  const border = (over: Partial<Border>): Border => ({
    color: "#ff0000",
    width: 4,
    style: "solid",
    padding: 8,
    ...over,
  })

  it("treats two invisible borders as equal", () => {
    expect(
      bordersDiffer(INVISIBLE_BORDER, border({ color: null, width: 0 }))
    ).toBe(false)
  })

  it("detects a real border change", () => {
    expect(bordersDiffer(border({ width: 4 }), border({ width: 8 }))).toBe(true)
    expect(
      bordersDiffer(border({ color: "#ff0000" }), border({ color: "#00ff00" }))
    ).toBe(true)
  })

  it("returns the endpoints at p=0 and p=1", () => {
    const from = border({ color: "#000000", width: 2, padding: 0 })
    const to = border({ color: "#ffffff", width: 10, padding: 20 })
    const start = borderBetween(from, to, 0)
    expect(start.width).toBe(2)
    expect(start.color).toBe("rgba(0, 0, 0, 1.000)")
    const end = borderBetween(from, to, 1)
    expect(end.width).toBe(10)
    expect(end.color).toBe("rgba(255, 255, 255, 1.000)")
  })

  it("eases width/padding and snaps style at the midpoint", () => {
    const from = border({ width: 0, padding: 0, style: "solid" })
    const to = border({ width: 10, padding: 40, style: "dashed" })
    const mid = borderBetween(from, to, 0.5)
    expect(mid.width).toBe(5)
    expect(mid.padding).toBe(20)
    expect(mid.style).toBe("dashed") // p >= 0.5 → snaps to target style
    expect(borderBetween(from, to, 0.49).style).toBe("solid")
  })

  it("fades alpha from an invisible border without sliding hue", () => {
    const mid = borderBetween(
      INVISIBLE_BORDER,
      border({ color: "#ffffff", width: 8 }),
      0.5
    )
    // Invisible side borrows the target rgb, so only alpha ramps (0 → 1).
    expect(mid.color).toBe("rgba(255, 255, 255, 0.500)")
  })
})

describe("backgroundsDiffer", () => {
  it("differs when the type changes", () => {
    const a: Background = { type: "solid", value: "#111111" }
    const b: Background = { type: "gradient", value: "linear-gradient(...)" }
    expect(backgroundsDiffer(a, b)).toBe(true)
  })

  it("compares solid backgrounds by value", () => {
    expect(
      backgroundsDiffer(
        { type: "solid", value: "#111111" },
        { type: "solid", value: "#111111" }
      )
    ).toBe(false)
    expect(
      backgroundsDiffer(
        { type: "solid", value: "#111111" },
        { type: "solid", value: "#222222" }
      )
    ).toBe(true)
  })

  it("compares image backgrounds by stable source, not the preview value", () => {
    const a: Background = {
      type: "image",
      value: "https://cdn/thumb.jpg",
      sourceUrl: "https://cdn/full.jpg",
    }
    const b: Background = {
      type: "image",
      value: "https://cdn/preview.jpg",
      sourceUrl: "https://cdn/full.jpg",
    }
    // Same sourceUrl, different preview value → NOT different.
    expect(backgroundsDiffer(a, b)).toBe(false)
  })
})
