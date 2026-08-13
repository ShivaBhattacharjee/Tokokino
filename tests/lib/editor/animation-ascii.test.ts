import { describe, expect, it } from "vitest"

import {
  DEFAULT_BACKDROP_ASCII,
  ASCII_MAX_RESOLUTION,
  ASCII_MIN_RESOLUTION,
  normalizeAsciiResolution,
} from "@/lib/editor/ascii-backdrop"
import {
  asciiDiffer,
  EMPTY_ASCII_STACK,
  resolveAnimateAsciiStack,
} from "@/lib/editor/animation-playback"
import { DEFAULT_CANVAS_BASE } from "@/lib/editor/store/defaults"
import type {
  AnimationClip,
  AssetFilter,
  BackdropAscii,
  Background,
} from "@/lib/editor/state-types"

const committedBg: Background = {
  type: "gradient",
  value: "linear-gradient(#000,#fff)",
}
const otherBg: Background = { type: "solid", value: "#123456" }

const ascii = (over: Partial<BackdropAscii> = {}): BackdropAscii => ({
  ...DEFAULT_BACKDROP_ASCII,
  enabled: true,
  ...over,
})

const clip = (
  id: string,
  startMs: number,
  effects: AnimationClip["effects"],
  pose?: Partial<{
    ascii: BackdropAscii
    background: Background
    filter: AssetFilter
  }>
): AnimationClip => ({
  id,
  startMs,
  durationMs: 500,
  target: { scope: "main" },
  effects,
  baseline: {
    ...DEFAULT_CANVAS_BASE.backdrop,
    tilt: DEFAULT_CANVAS_BASE.tilt,
    scale: DEFAULT_CANVAS_BASE.scale,
    screenshotPosition: DEFAULT_CANVAS_BASE.screenshotPosition,
    screenshotOffset: DEFAULT_CANVAS_BASE.screenshotOffset,
    padding: DEFAULT_CANVAS_BASE.padding,
    canvasBorderRadius: DEFAULT_CANVAS_BASE.canvasBorderRadius,
    shadow: DEFAULT_CANVAS_BASE.shadow,
    backdropEffects: DEFAULT_CANVAS_BASE.backdrop.effects,
    background: committedBg,
    ascii: DEFAULT_BACKDROP_ASCII,
    slots: {},
  },
  pose: pose
    ? {
        ...DEFAULT_CANVAS_BASE.backdrop,
        tilt: DEFAULT_CANVAS_BASE.tilt,
        scale: DEFAULT_CANVAS_BASE.scale,
        screenshotPosition: DEFAULT_CANVAS_BASE.screenshotPosition,
        screenshotOffset: DEFAULT_CANVAS_BASE.screenshotOffset,
        padding: DEFAULT_CANVAS_BASE.padding,
        canvasBorderRadius: DEFAULT_CANVAS_BASE.canvasBorderRadius,
        shadow: DEFAULT_CANVAS_BASE.shadow,
        backdropEffects: DEFAULT_CANVAS_BASE.backdrop.effects,
        background: pose.background ?? committedBg,
        ascii: pose.ascii,
        filter: pose.filter,
        slots: {},
      }
    : undefined,
})

describe("resolveAnimateAsciiStack", () => {
  it("is empty when no clip touches ASCII or the background", () => {
    const stack = resolveAnimateAsciiStack(
      [clip("a", 0, ["tilt"])],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )
    expect(stack).toBe(EMPTY_ASCII_STACK)
  })

  it("builds one layer per ASCII keyframe, easing from the first clip's baseline", () => {
    const stack = resolveAnimateAsciiStack(
      [
        clip("k2", 1000, ["ascii"], { ascii: ascii({ charset: "blocks" }) }),
        clip("k1", 0, ["ascii"], { ascii: ascii({ charset: "dots" }) }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    // Chronological, bottom → top, regardless of input order.
    expect(stack.layers.map((l) => l.id)).toEqual(["k1", "k2"])
    expect(stack.base).toEqual(DEFAULT_BACKDROP_ASCII)
    expect(stack.layers[0].ascii.charset).toBe("dots")
    expect(stack.layers[1].ascii.charset).toBe("blocks")
  })

  it("gives a background keyframe its own layer so the glyphs follow the swap", () => {
    const stack = resolveAnimateAsciiStack(
      [
        clip("bg", 500, ["background"], { background: otherBg }),
        clip("k1", 0, ["ascii"], { ascii: ascii({ charset: "blocks" }) }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    expect(stack.layers.map((l) => l.id)).toEqual(["k1", "bg"])
    expect(stack.layers[0].background).toEqual(committedBg)
    expect(stack.layers[1].background).toEqual(otherBg)
    // The background-only keyframe carries the ASCII in force at that point,
    // rather than blanking the glyphs mid-timeline.
    expect(stack.layers[1].ascii.charset).toBe("blocks")
    expect(stack.layers[1].ascii.enabled).toBe(true)
  })

  it("carries a background keyframe forward onto later ASCII-only keyframes", () => {
    // The ASCII keyframe's own pose still holds the pre-swap background (a
    // captured pose carries every axis, owned or not). Playback shows the
    // swapped background at that point, so the glyphs must too.
    const stack = resolveAnimateAsciiStack(
      [
        clip("bg", 0, ["background"], { background: otherBg }),
        clip("k1", 1000, ["ascii"], {
          ascii: ascii({ charset: "dots" }),
          background: committedBg,
        }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    expect(stack.layers.map((l) => l.id)).toEqual(["bg", "k1"])
    expect(stack.layers[0].background).toEqual(otherBg)
    expect(stack.layers[1].background).toEqual(otherBg)
    expect(stack.layers[1].ascii.charset).toBe("dots")
  })

  it("shows only the selected keyframe's layer at rest, and reads it live", () => {
    const live = ascii({ charset: "stars", resolution: 120 })
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii({ charset: "dots" }) }),
        clip("k2", 1000, ["ascii"], { ascii: ascii({ charset: "blocks" }) }),
      ],
      { ascii: live, background: committedBg, filter: "none" },
      "k1"
    )

    expect(stack.layers.map((l) => l.restOpaque)).toEqual([true, false])
    // The open keyframe renders the committed (being-edited) value.
    expect(stack.layers[0].ascii).toBe(live)
  })

  it("samples the open keyframe's glyphs from the live background", () => {
    // Editing a keyframe writes to the committed canvas, not to the clip's
    // stored pose — so a background change while it is open must reach the
    // ASCII layer, or the glyphs would lag one edit behind the background.
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii", "background"], {
          ascii: ascii(),
          background: committedBg,
        }),
        clip("k2", 1000, ["ascii"], { ascii: ascii({ charset: "dots" }) }),
      ],
      { ascii: ascii(), background: otherBg, filter: "none" },
      "k1"
    )

    expect(stack.layers[0].background).toEqual(otherBg)
    // The later ASCII-only keyframe doesn't own the background, so it inherits
    // the live edit rather than re-asserting the background in its own pose.
    expect(stack.layers[1].background).toEqual(otherBg)
  })

  it("keeps a later background keyframe's own swap", () => {
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii(), background: committedBg }),
        clip("bg", 1000, ["background"], { background: otherBg }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    expect(stack.layers[0].background).toEqual(committedBg)
    expect(stack.layers[1].background).toEqual(otherBg)
  })

  it("reveals each axis from the first clip that owns it", () => {
    // Baselines are captured per clip at different times, so the ASCII-only
    // keyframe's baseline background can differ from the background keyframe's.
    // The base layer has to sample the one the background stack renders (which
    // reads bgClips[0]'s baseline), or the pre-keyframe glyphs would be drawn
    // from a background nobody is looking at.
    const asciiFirst = clip("k1", 0, ["ascii"], { ascii: ascii() })
    const bgLater: AnimationClip = {
      ...clip("bg", 1000, ["background"], { background: otherBg }),
      baseline: {
        ...clip("bg", 1000, ["background"]).baseline!,
        background: otherBg,
      },
    }

    const stack = resolveAnimateAsciiStack(
      [asciiFirst, bgLater],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    // asciiFirst's baseline says committedBg; the background stack reveals from
    // bgLater's baseline, so the ASCII base must too.
    expect(stack.baseBackground).toEqual(otherBg)
    expect(stack.base).toEqual(DEFAULT_BACKDROP_ASCII)
  })

  it("falls back to the committed values when no clip owns an axis", () => {
    const stack = resolveAnimateAsciiStack(
      [clip("k1", 0, ["ascii"], { ascii: ascii() })],
      { ascii: ascii(), background: committedBg, filter: "bw" },
      null
    )
    // No background or filter keyframe exists, so both hold at the committed
    // value for the whole timeline.
    expect(stack.baseBackground).toEqual(committedBg)
    expect(stack.baseFilter).toBe("bw")
  })

  it("gives a filter keyframe its own layer and carries the preset forward", () => {
    // An active ASCII layer COVERS the background, so animating the filter on
    // the hidden background beneath would show nothing.
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii() }),
        clip("fx", 1000, ["filter"], { filter: "noir" }),
        clip("k2", 2000, ["ascii"], { ascii: ascii({ charset: "dots" }) }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )

    expect(stack.layers.map((l) => l.id)).toEqual(["k1", "fx", "k2"])
    expect(stack.layers.map((l) => l.filter)).toEqual(["none", "noir", "noir"])
  })

  it("holds the layer in force when the selected keyframe owns nothing of its own", () => {
    // Selecting a tilt-only keyframe between two ASCII keyframes must preview
    // the state at ITS point on the timeline, not the timeline's end state.
    const clips = [
      clip("k1", 0, ["ascii"], { ascii: ascii({ charset: "blocks" }) }),
      clip("tilt", 500, ["tilt"]),
      clip("k2", 1000, ["ascii"], { ascii: ascii({ charset: "stars" }) }),
    ]
    const committed = {
      ascii: ascii(),
      background: committedBg,
      filter: "none" as const,
    }

    const mid = resolveAnimateAsciiStack(clips, committed, "tilt")
    expect(mid.layers.map((l) => l.restOpaque)).toEqual([true, false])
    expect(mid.layers[0].ascii.charset).toBe("blocks")
    expect(mid.baseRestOpaque).toBe(false)

    // A selection before every ASCII keyframe falls back to the base layer.
    const early = resolveAnimateAsciiStack(
      [clip("tilt", 0, ["tilt"]), clips[2]],
      committed,
      "tilt"
    )
    expect(early.layers.every((l) => !l.restOpaque)).toBe(true)
    expect(early.baseRestOpaque).toBe(true)
  })

  it("holds the last layer at rest when no keyframe is open", () => {
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii() }),
        clip("k2", 1000, ["ascii"], { ascii: ascii({ enabled: false }) }),
      ],
      { ascii: ascii(), background: committedBg, filter: "none" },
      null
    )
    expect(stack.layers.map((l) => l.restOpaque)).toEqual([false, true])
  })
})

describe("asciiDiffer", () => {
  it("sees every rendered field", () => {
    const base = ascii()
    expect(asciiDiffer(base, { ...base })).toBe(false)
    expect(asciiDiffer(base, { ...base, enabled: false })).toBe(true)
    expect(asciiDiffer(base, { ...base, resolution: 150 })).toBe(true)
    expect(asciiDiffer(base, { ...base, charset: "binary" })).toBe(true)
    expect(asciiDiffer(base, { ...base, colored: !base.colored })).toBe(true)
    expect(asciiDiffer(base, { ...base, inverted: !base.inverted })).toBe(true)
    expect(asciiDiffer(base, { ...base, color: "#FF0000" })).toBe(true)
    expect(asciiDiffer(base, { ...base, opacity: 40 })).toBe(true)
  })
})

describe("normalizeAsciiResolution", () => {
  it("reads its range from the shared value schema", () => {
    expect(ASCII_MIN_RESOLUTION).toBe(20)
    expect(ASCII_MAX_RESOLUTION).toBe(200)
  })

  it("clamps and rounds anything the UI or a draft can hand it", () => {
    expect(normalizeAsciiResolution(5)).toBe(ASCII_MIN_RESOLUTION)
    expect(normalizeAsciiResolution(9999)).toBe(ASCII_MAX_RESOLUTION)
    expect(normalizeAsciiResolution(90.6)).toBe(91)
    expect(normalizeAsciiResolution(Number.NaN)).toBe(
      DEFAULT_BACKDROP_ASCII.resolution
    )
  })
})
