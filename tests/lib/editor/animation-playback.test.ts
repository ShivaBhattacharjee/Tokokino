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
  cropRegionBetween,
  DEFAULT_BASELINE,
  EMPTY_FILTER_STACK,
  filtersDiffer,
  FULL_CROP_REGION,
  INVISIBLE_BORDER,
  lerp,
  resolveAnimateFilterStack,
  sampleKeyframes,
  sampleShadowLayers,
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

  it("holds the pose (1) after the clip when it opts out of releasing", () => {
    const holding = [
      clip({
        id: "a",
        startMs: 1000,
        durationMs: 1000,
        returnToDefault: false,
      }),
    ]
    expect(clipsProgressAt(holding, 5000)).toBe(1)
  })

  it("holds the pose (1) in a gap when both clips opt out", () => {
    const two = [
      clip({ id: "a", startMs: 0, durationMs: 1000, returnToDefault: false }),
      clip({
        id: "b",
        startMs: 4000,
        durationMs: 1000,
        returnToDefault: false,
      }),
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

  it("uses a frame's own ease over the default ease-out", () => {
    const linear = [
      { startMs: 0, durationMs: 1000, value: 10, ease: (t: number) => t },
    ]
    // Linear ease at 0.5 → lerp(0,10,0.5)=5, vs the ease-out default's 8.75.
    expect(sampleKeyframes(linear, 500, 0, num)).toBeCloseTo(5, 5)
  })
})

describe("per-clip easing & speed", () => {
  it("clipsProgressAt applies a clip's linear easing instead of ease-out", () => {
    const linear = [
      clip({ id: "a", startMs: 0, durationMs: 1000, easing: "linear" }),
    ]
    expect(clipsProgressAt(linear, 500)).toBeCloseTo(0.5, 5)
  })

  it("clipsProgressAt still defaults to ease-out with no easing set", () => {
    const dflt = [clip({ id: "a", startMs: 0, durationMs: 1000 })]
    expect(clipsProgressAt(dflt, 500)).toBeCloseTo(EASED_HALF, 5)
  })

  it("clipsProgressAt completes early then holds when speed > 1", () => {
    const fast = [
      clip({
        id: "a",
        startMs: 0,
        durationMs: 1000,
        easing: "linear",
        speed: 2,
      }),
    ]
    // Speed 2 reaches the pose at half the window, then holds at 1.
    expect(clipsProgressAt(fast, 250)).toBeCloseTo(0.5, 5)
    expect(clipsProgressAt(fast, 500)).toBeCloseTo(1, 5)
    expect(clipsProgressAt(fast, 750)).toBeCloseTo(1, 5)
  })

  it("activeClipAt reports the clip's eased progress", () => {
    const linear = clip({
      id: "a",
      startMs: 0,
      durationMs: 1000,
      easing: "linear",
    })
    expect(activeClipAt([linear], 500)!.progress).toBeCloseTo(0.5, 5)
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

describe("cropRegionBetween", () => {
  const from = { x: 0, y: 0, width: 100, height: 100 }
  const to = { x: 20, y: 10, width: 50, height: 60 }

  it("eases every edge of the source rect", () => {
    expect(cropRegionBetween(from, to, 0)).toEqual(from)
    expect(cropRegionBetween(from, to, 1)).toEqual(to)
    expect(cropRegionBetween(from, to, 0.5)).toEqual({
      x: 10,
      y: 5,
      width: 75,
      height: 80,
    })
  })

  it("reveals from the full frame when a pose carries no crop", () => {
    expect(FULL_CROP_REGION).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    // A clip with no captured crop must read as "uncropped", not as a zero rect.
    expect(cropRegionBetween(FULL_CROP_REGION, to, 0)).toEqual(FULL_CROP_REGION)
  })

  it("holds the last crop past the end of the timeline", () => {
    const frames = [{ startMs: 0, durationMs: 100, value: to }]
    expect(
      sampleKeyframes(frames, 500, FULL_CROP_REGION, cropRegionBetween)
    ).toEqual(to)
  })
})

describe("return to default (release)", () => {
  const num = (from: number, to: number, p: number) => lerp(from, to, p)
  const linear = (t: number) => t
  // A frame that reaches 10 over [0,1000], then unwinds to rest across 1000ms.
  const releasing = [
    {
      startMs: 0,
      durationMs: 1000,
      value: 10,
      ease: linear,
      releaseMs: 1000,
      releaseEase: linear,
    },
  ]

  it("sampleKeyframes still holds when a frame has no release", () => {
    const holding = [{ startMs: 0, durationMs: 1000, value: 10, ease: linear }]
    expect(sampleKeyframes(holding, 5000, 0, num)).toBe(10)
    expect(
      sampleKeyframes(
        holding.map((f) => ({ ...f, releaseMs: 0 })),
        5000,
        0,
        num
      )
    ).toBe(10)
  })

  it("sampleKeyframes sits on the pose the instant the window ends", () => {
    expect(sampleKeyframes(releasing, 1000, 0, num)).toBeCloseTo(10, 5)
  })

  it("sampleKeyframes eases back toward rest across the release", () => {
    expect(sampleKeyframes(releasing, 1500, 0, num)).toBeCloseTo(5, 5)
    expect(sampleKeyframes(releasing, 1750, 0, num)).toBeCloseTo(2.5, 5)
  })

  it("sampleKeyframes lands exactly on rest and stays there", () => {
    expect(sampleKeyframes(releasing, 2000, 0, num)).toBeCloseTo(0, 5)
    expect(sampleKeyframes(releasing, 99000, 0, num)).toBeCloseTo(0, 5)
  })

  it("returns to a non-zero rest, not to zero", () => {
    expect(sampleKeyframes(releasing, 2000, 4, num)).toBeCloseTo(4, 5)
  })

  it("releases into a gap rather than holding through it", () => {
    const frames = [
      ...releasing,
      { startMs: 4000, durationMs: 1000, value: 20, ease: linear },
    ]
    expect(sampleKeyframes(frames, 1500, 0, num)).toBeCloseTo(5, 5)
    expect(sampleKeyframes(frames, 3000, 0, num)).toBeCloseTo(0, 5)
  })

  it("a next frame butted against the release still departs from the full pose", () => {
    // Chain continuity: B starts the instant A ends, so A has released nothing.
    const frames = [
      ...releasing,
      { startMs: 1000, durationMs: 1000, value: 20, ease: linear },
    ]
    expect(sampleKeyframes(frames, 1000, 0, num)).toBeCloseTo(10, 5)
    expect(sampleKeyframes(frames, 1500, 0, num)).toBeCloseTo(15, 5)
  })

  it("a next frame starting mid-release departs from the decayed value", () => {
    // B starts at 1500 — half of A's release, so A reads 5, not 10.
    const frames = [
      ...releasing,
      { startMs: 1500, durationMs: 1000, value: 20, ease: linear },
    ]
    expect(sampleKeyframes(frames, 1500, 0, num)).toBeCloseTo(5, 5)
    expect(sampleKeyframes(frames, 2000, 0, num)).toBeCloseTo(12.5, 5)
  })

  it("clipsProgressAt unwinds to 0 after a releasing clip", () => {
    const clips = [
      clip({
        id: "a",
        startMs: 0,
        durationMs: 1000,
        easing: "linear",
        returnToDefault: true,
      }),
    ]
    expect(clipsProgressAt(clips, 1000)).toBeCloseTo(1, 5)
    expect(clipsProgressAt(clips, 1500)).toBeCloseTo(0.5, 5)
    expect(clipsProgressAt(clips, 2000)).toBeCloseTo(0, 5)
    expect(clipsProgressAt(clips, 9000)).toBeCloseTo(0, 5)
  })

  it("clipsProgressAt unwinds in a gap that follows a releasing clip", () => {
    const clips = [
      clip({
        id: "a",
        startMs: 0,
        durationMs: 1000,
        easing: "linear",
        returnToDefault: true,
      }),
      clip({ id: "b", startMs: 6000, durationMs: 1000 }),
    ]
    expect(clipsProgressAt(clips, 1500)).toBeCloseTo(0.5, 5)
    expect(clipsProgressAt(clips, 4000)).toBeCloseTo(0, 5)
  })

  it("clipsProgressAt keeps holding for a clip that opts out", () => {
    const clips = [
      clip({ id: "a", startMs: 0, durationMs: 1000, returnToDefault: false }),
    ]
    expect(clipsProgressAt(clips, 9000)).toBe(1)
  })

  it("releases by default — an unflagged clip does not hold its pose", () => {
    const clips = [
      clip({ id: "a", startMs: 0, durationMs: 1000, easing: "linear" }),
    ]
    expect(clipsProgressAt(clips, 2000)).toBeCloseTo(0, 5)
  })

  it("speed shortens the release window along with the transition", () => {
    const clips = [
      clip({
        id: "a",
        startMs: 0,
        durationMs: 1000,
        easing: "linear",
        speed: 2,
        returnToDefault: true,
      }),
    ]
    // Active (and so release) is 500ms: fully unwound 500ms past the window.
    expect(clipsProgressAt(clips, 1250)).toBeCloseTo(0.5, 5)
    expect(clipsProgressAt(clips, 1500)).toBeCloseTo(0, 5)
  })
})

describe("sampleShadowLayers", () => {
  const linear = (t: number) => t
  const none: Shadow = {
    type: "none",
    intensity: 0,
    color: "#000000",
    lightSource: "center",
  }
  const soft: Shadow = {
    type: "soft",
    intensity: 80,
    color: "#000000",
    lightSource: "center",
  }
  const glow: Shadow = {
    type: "glow",
    intensity: 60,
    color: "#ffffff",
    lightSource: "center",
  }
  const frame = (value: Shadow, over: Record<string, unknown> = {}) => ({
    startMs: 0,
    durationMs: 1000,
    value,
    ease: linear,
    releaseMs: 1000,
    releaseEase: linear,
    ...over,
  })

  it("returns null when no keyframe animates the shadow", () => {
    expect(sampleShadowLayers([], 500, none)).toBeNull()
  })

  it("reveals from the rest shadow", () => {
    expect(
      sampleShadowLayers([frame(soft)], 0, none)![0].intensity
    ).toBeCloseTo(0, 5)
    expect(
      sampleShadowLayers([frame(soft)], 500, none)![0].intensity
    ).toBeCloseTo(40, 5)
  })

  it("holds the pose past the end when the frame opts out", () => {
    const holding = [frame(soft, { releaseMs: 0 })]
    expect(sampleShadowLayers(holding, 9000, none)).toEqual([soft])
  })

  it("fades back out to an invisible rest on its own type", () => {
    // Retract semantics: it recedes as a `soft` shadow losing intensity rather
    // than blinking off, mirroring how it revealed.
    const mid = sampleShadowLayers([frame(soft)], 1500, none)!
    expect(mid).toHaveLength(1)
    expect(mid[0].type).toBe("soft")
    expect(mid[0].intensity).toBeCloseTo(40, 5)

    expect(sampleShadowLayers([frame(soft)], 2000, none)![0].intensity).toBe(0)
  })

  it("cross-blends back when rest is a different visible shadow", () => {
    const mid = sampleShadowLayers([frame(soft)], 1500, glow)!
    expect(mid.map((s) => s.type)).toEqual(["soft", "glow"])
    expect(mid[0].intensity).toBeCloseTo(40, 5) // pose easing OUT
    expect(mid[1].intensity).toBeCloseTo(30, 5) // rest easing back IN
  })

  it("sits exactly on the pose the instant the window ends", () => {
    // lightSource normalizes to grid coords through the blend, so compare the
    // fields the release actually drives.
    const layers = sampleShadowLayers([frame(soft)], 1000, none)!
    expect(layers).toHaveLength(1)
    expect(layers[0].type).toBe(soft.type)
    expect(layers[0].intensity).toBeCloseTo(soft.intensity, 5)
  })

  it("releases into a gap instead of holding through it", () => {
    const frames = [
      frame(soft),
      { startMs: 4000, durationMs: 1000, value: glow, ease: linear },
    ]
    expect(sampleShadowLayers(frames, 1500, none)![0].intensity).toBeCloseTo(
      40,
      5
    )
    expect(sampleShadowLayers(frames, 3000, none)![0].intensity).toBe(0)
  })

  it("a next frame butted against the release departs from the full pose", () => {
    const frames = [
      frame(soft),
      { startMs: 1000, durationMs: 1000, value: soft, ease: linear },
    ]
    expect(sampleShadowLayers(frames, 1000, none)![0].intensity).toBeCloseTo(
      80,
      5
    )
  })
})
