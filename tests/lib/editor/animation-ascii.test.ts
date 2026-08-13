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
  pose?: Partial<{ ascii: BackdropAscii; background: Background }>
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
        slots: {},
      }
    : undefined,
})

describe("resolveAnimateAsciiStack", () => {
  it("is empty when no clip touches ASCII or the background", () => {
    const stack = resolveAnimateAsciiStack(
      [clip("a", 0, ["tilt"])],
      ascii(),
      committedBg,
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
      ascii(),
      committedBg,
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
      ascii(),
      committedBg,
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

  it("shows only the selected keyframe's layer at rest, and reads it live", () => {
    const live = ascii({ charset: "stars", resolution: 120 })
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii({ charset: "dots" }) }),
        clip("k2", 1000, ["ascii"], { ascii: ascii({ charset: "blocks" }) }),
      ],
      live,
      committedBg,
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
      ascii(),
      otherBg,
      "k1"
    )

    expect(stack.layers[0].background).toEqual(otherBg)
    // Unselected keyframes still read their own stored pose.
    expect(stack.layers[1].background).toEqual(committedBg)
  })

  it("holds the last layer at rest when no keyframe is open", () => {
    const stack = resolveAnimateAsciiStack(
      [
        clip("k1", 0, ["ascii"], { ascii: ascii() }),
        clip("k2", 1000, ["ascii"], { ascii: ascii({ enabled: false }) }),
      ],
      ascii(),
      committedBg,
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
