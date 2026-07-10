import { describe, expect, it } from "vitest"

import {
  CLIP_EASING_KINDS,
  CLIP_EASING_LABELS,
  clipEasingKind,
  clipProgressEase,
  clipSpeed,
  DEFAULT_CLIP_EASING,
  DEFAULT_CLIP_SPEED,
  easingDotAt,
  easingFn,
  easingSvgPath,
  effectiveActiveMs,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
} from "@/lib/editor/clip-easing"
import type { AnimationClip } from "@/lib/editor/state-types"

const clip = (over: Partial<AnimationClip> = {}): AnimationClip => ({
  id: "c",
  startMs: 0,
  durationMs: 1000,
  ...over,
})

describe("clipEasingKind", () => {
  it("defaults to the historic ease-out when unset", () => {
    expect(clipEasingKind(clip())).toBe(DEFAULT_CLIP_EASING)
    expect(DEFAULT_CLIP_EASING).toBe("out")
  })

  it("passes an explicit kind through", () => {
    expect(clipEasingKind(clip({ easing: "linear" }))).toBe("linear")
  })
})

describe("clipSpeed", () => {
  it("defaults to 1 (full window) when unset", () => {
    expect(clipSpeed(clip())).toBe(DEFAULT_CLIP_SPEED)
    expect(DEFAULT_CLIP_SPEED).toBe(1)
  })

  it("clamps into [MIN, MAX]", () => {
    expect(clipSpeed(clip({ speed: 0.2 }))).toBe(MIN_CLIP_SPEED)
    expect(clipSpeed(clip({ speed: 99 }))).toBe(MAX_CLIP_SPEED)
    expect(clipSpeed(clip({ speed: 3 }))).toBe(3)
  })

  it("falls back to the default for non-finite values", () => {
    expect(clipSpeed(clip({ speed: Number.NaN }))).toBe(DEFAULT_CLIP_SPEED)
    expect(clipSpeed(clip({ speed: Infinity }))).toBe(DEFAULT_CLIP_SPEED)
  })
})

describe("easingFn", () => {
  it("every curve pins the endpoints 0→0 and 1→1", () => {
    for (const kind of CLIP_EASING_KINDS) {
      const fn = easingFn(kind)
      expect(fn(0)).toBeCloseTo(0, 6)
      expect(fn(1)).toBeCloseTo(1, 6)
    }
  })

  it("has the expected midpoints per curve", () => {
    expect(easingFn("linear")(0.5)).toBeCloseTo(0.5, 6)
    expect(easingFn("cubic")(0.5)).toBeCloseTo(0.5, 6) // symmetric S
    expect(easingFn("in")(0.5)).toBeCloseTo(0.125, 6) // t^3
    expect(easingFn("out")(0.5)).toBeCloseTo(0.875, 6) // 1-(1-t)^3
    expect(easingFn("inOut")(0.5)).toBeCloseTo(0.5, 6) // symmetric S
    expect(easingFn("outCirc")(0.5)).toBeCloseTo(Math.sqrt(0.75), 6)
  })

  it("is monotonically non-decreasing across the curve", () => {
    for (const kind of CLIP_EASING_KINDS) {
      const fn = easingFn(kind)
      let prev = fn(0)
      for (let i = 1; i <= 20; i++) {
        const v = fn(i / 20)
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = v
      }
    }
  })
})

describe("clipProgressEase", () => {
  it("an unset clip eases as ease-out over the full window", () => {
    const p = clipProgressEase(clip())
    expect(p(0)).toBeCloseTo(0, 6)
    expect(p(0.5)).toBeCloseTo(0.875, 6)
    expect(p(1)).toBeCloseTo(1, 6)
  })

  it("applies the chosen curve", () => {
    const p = clipProgressEase(clip({ easing: "linear" }))
    expect(p(0.5)).toBeCloseTo(0.5, 6)
  })

  it("speed compresses the ramp so it completes early then holds at 1", () => {
    const p = clipProgressEase(clip({ easing: "linear", speed: 2 }))
    // Reaches the pose at half the window (rawT 0.5), then holds.
    expect(p(0.25)).toBeCloseTo(0.5, 6)
    expect(p(0.5)).toBeCloseTo(1, 6)
    expect(p(0.9)).toBeCloseTo(1, 6)
  })

  it("clamps raw progress outside [0,1]", () => {
    const p = clipProgressEase(clip({ easing: "linear" }))
    expect(p(-1)).toBeCloseTo(0, 6)
    expect(p(2)).toBeCloseTo(1, 6)
  })
})

describe("effectiveActiveMs", () => {
  it("is the full duration at speed 1 and shrinks with speed", () => {
    expect(effectiveActiveMs(clip({ durationMs: 1200 }))).toBe(1200)
    expect(effectiveActiveMs(clip({ durationMs: 1200, speed: 2 }))).toBe(600)
    expect(effectiveActiveMs(clip({ durationMs: 1200, speed: 5 }))).toBe(240)
  })

  it("returns a rounded integer for fractional windows", () => {
    const ms = effectiveActiveMs(clip({ durationMs: 4488.33, speed: 5 }))
    expect(Number.isInteger(ms)).toBe(true)
  })
})

describe("labels & kinds", () => {
  it("exposes exactly six kinds each with a label", () => {
    expect(CLIP_EASING_KINDS).toHaveLength(6)
    for (const kind of CLIP_EASING_KINDS) {
      expect(CLIP_EASING_LABELS[kind]).toBeTruthy()
    }
  })
})

describe("easingSvgPath", () => {
  it("starts with a move and has one line per sample", () => {
    const path = easingSvgPath("linear", 100, 10, 4)
    expect(path.startsWith("M")).toBe(true)
    expect((path.match(/L/g) ?? []).length).toBe(4)
  })

  it("stays within the padded box", () => {
    const path = easingSvgPath("out", 100, 12, 8)
    const coords = path.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number)
    for (const n of coords) {
      expect(n).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(n).toBeLessThanOrEqual(88 + 1e-6)
    }
  })
})

describe("easingDotAt", () => {
  it("maps t=0 to bottom-left and t=1 to top-right of the padded box", () => {
    const size = 100
    const pad = 10
    const start = easingDotAt("linear", 0, size, pad)
    expect(start.x).toBeCloseTo(pad, 6)
    expect(start.y).toBeCloseTo(size - pad, 6) // y is inverted (SVG y-down)

    const end = easingDotAt("linear", 1, size, pad)
    expect(end.x).toBeCloseTo(size - pad, 6)
    expect(end.y).toBeCloseTo(pad, 6)
  })
})
