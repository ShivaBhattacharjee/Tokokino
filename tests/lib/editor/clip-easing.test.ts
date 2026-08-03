import { describe, expect, it } from "vitest"

import {
  BEZIER_Y_MAX,
  BEZIER_Y_MIN,
  CLIP_EASING_KINDS,
  CLIP_EASING_LABELS,
  clipEasingBezier,
  clipEasingKind,
  clipProgressEase,
  clipReleaseEase,
  clipReleaseMs,
  clipReturnsToDefault,
  clipSpeed,
  cubicBezierEase,
  DEFAULT_CLIP_EASING,
  DEFAULT_CLIP_SPEED,
  DEFAULT_CUSTOM_BEZIER,
  NEW_CLIP_EASING,
  easingDotAt,
  easingFn,
  easingSvgPath,
  effectiveActiveMs,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  normalizeBezier,
  PRESET_BEZIER_SEEDS,
  resolveEasingFn,
  svgToUnit,
  unitToSvg,
} from "@/lib/editor/clip-easing"
import type { AnimationClip } from "@/lib/editor/state-types"

const clip = (over: Partial<AnimationClip> = {}): AnimationClip => ({
  id: "c",
  startMs: 0,
  durationMs: 1000,
  ...over,
})

describe("clipEasingKind", () => {
  it("defaults to historic ease-out when unset (legacy drafts/templates)", () => {
    expect(clipEasingKind(clip())).toBe(DEFAULT_CLIP_EASING)
    expect(DEFAULT_CLIP_EASING).toBe("out")
  })

  it("new clips use an explicit linear default separate from the fallback", () => {
    expect(NEW_CLIP_EASING).toBe("linear")
    expect(NEW_CLIP_EASING).not.toBe(DEFAULT_CLIP_EASING)
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
  it("an unset clip eases as ease-out over the full window (legacy fallback)", () => {
    const p = clipProgressEase(clip())
    expect(p(0)).toBeCloseTo(0, 6)
    expect(p(0.5)).toBeCloseTo(0.875, 6)
    expect(p(1)).toBeCloseTo(1, 6)
  })

  it("applies the chosen curve", () => {
    const p = clipProgressEase(clip({ easing: "out" }))
    expect(p(0.5)).toBeCloseTo(0.875, 6)
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
  it("exposes five grid presets each with a label, plus Custom", () => {
    expect(CLIP_EASING_KINDS).toHaveLength(5)
    for (const kind of CLIP_EASING_KINDS) {
      expect(CLIP_EASING_LABELS[kind]).toBeTruthy()
    }
    expect(CLIP_EASING_LABELS.custom).toBe("Custom")
    // outCirc remains a valid kind (drafts/templates) but is not a grid tile.
    expect(CLIP_EASING_LABELS.outCirc).toBe("Out Circ")
  })
})

describe("custom cubic-bezier", () => {
  it("normalizeBezier fills defaults and clamps both axes to [0,1]", () => {
    expect(normalizeBezier(undefined)).toEqual(DEFAULT_CUSTOM_BEZIER)
    expect(normalizeBezier({ x1: -1, y1: 0.5, x2: 2, y2: 0.5 })).toEqual({
      x1: 0,
      y1: 0.5,
      x2: 1,
      y2: 0.5,
    })
    expect(normalizeBezier({ x1: 0.2, y1: -0.5, x2: 0.8, y2: 1.5 })).toEqual({
      x1: 0.2,
      y1: 0,
      x2: 0.8,
      y2: 1,
    })
  })

  it("linear bezier maps t → t", () => {
    const fn = cubicBezierEase({ x1: 0, y1: 0, x2: 1, y2: 1 })
    expect(fn(0)).toBeCloseTo(0, 5)
    expect(fn(0.5)).toBeCloseTo(0.5, 5)
    expect(fn(1)).toBeCloseTo(1, 5)
  })

  it("pins endpoints for any control points", () => {
    const fn = cubicBezierEase({ x1: 0.2, y1: 0.9, x2: 0.8, y2: 0.1 })
    expect(fn(0)).toBeCloseTo(0, 5)
    expect(fn(1)).toBeCloseTo(1, 5)
  })

  it("clipProgressEase uses the clip's custom bezier", () => {
    const p = clipProgressEase(
      clip({
        easing: "custom",
        easingBezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
      })
    )
    expect(p(0.25)).toBeCloseTo(0.25, 4)
    expect(p(0.75)).toBeCloseTo(0.75, 4)
  })

  it("resolveEasingFn falls back to default custom bezier when unset", () => {
    const a = resolveEasingFn({ easing: "custom" })
    const b = cubicBezierEase(DEFAULT_CUSTOM_BEZIER)
    expect(a(0.4)).toBeCloseTo(b(0.4), 5)
  })

  it("clipEasingBezier returns the stored handles", () => {
    const bezier = { x1: 0.1, y1: 0.2, x2: 0.8, y2: 0.9 }
    expect(clipEasingBezier(clip({ easingBezier: bezier }))).toEqual(bezier)
  })

  it("easingSvgPath draws a custom curve", () => {
    const path = easingSvgPath("custom", 100, 10, 4, {
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
    })
    expect(path.startsWith("M")).toBe(true)
    expect((path.match(/L/g) ?? []).length).toBe(4)
  })

  it("clipProgressEase applies speed with a custom bezier", () => {
    const p = clipProgressEase(
      clip({
        easing: "custom",
        easingBezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
        speed: 2,
      })
    )
    // Linear bezier + speed 2 → pose at half the window.
    expect(p(0.25)).toBeCloseTo(0.5, 4)
    expect(p(0.5)).toBeCloseTo(1, 4)
  })

  it("clipReleaseEase uses the custom bezier without speed remap", () => {
    const c = clip({
      easing: "custom",
      easingBezier: { x1: 0, y1: 0, x2: 1, y2: 1 },
      speed: 4,
    })
    expect(clipProgressEase(c)(0.5)).toBeCloseTo(1, 4)
    expect(clipReleaseEase(c)(0.5)).toBeCloseTo(0.5, 4)
  })

  it("easingFn('custom') matches DEFAULT_CUSTOM_BEZIER", () => {
    const a = easingFn("custom")
    const b = cubicBezierEase(DEFAULT_CUSTOM_BEZIER)
    expect(a(0.3)).toBeCloseTo(b(0.3), 5)
    expect(a(0.7)).toBeCloseTo(b(0.7), 5)
  })

  it("easingDotAt tracks a custom curve", () => {
    const pad = 10
    const size = 100
    const start = easingDotAt("custom", 0, size, pad, {
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
    })
    expect(start.x).toBeCloseTo(pad, 5)
    expect(start.y).toBeCloseTo(size - pad, 5)
  })

  it("PRESET_BEZIER_SEEDS cover every named kind including outCirc", () => {
    for (const kind of [...CLIP_EASING_KINDS, "outCirc" as const]) {
      const seed = PRESET_BEZIER_SEEDS[kind]
      expect(seed).toBeDefined()
      const n = normalizeBezier(seed)
      expect(n.x1).toBeGreaterThanOrEqual(0)
      expect(n.x1).toBeLessThanOrEqual(1)
      expect(n.y1).toBeGreaterThanOrEqual(BEZIER_Y_MIN)
      expect(n.y1).toBeLessThanOrEqual(BEZIER_Y_MAX)
    }
  })

  it("ease-in-out default custom is between linear midpoints at 0.25 and 0.75", () => {
    // DEFAULT_CUSTOM_BEZIER ≈ CSS ease-in-out: slow start & finish, faster middle.
    const fn = cubicBezierEase(DEFAULT_CUSTOM_BEZIER)
    expect(fn(0.25)).toBeLessThan(0.25)
    expect(fn(0.75)).toBeGreaterThan(0.75)
  })
})

describe("unitToSvg / svgToUnit", () => {
  it("round-trips corners of the unit square", () => {
    const size = 100
    const pad = 12
    for (const [ux, uy] of [
      [0, 0],
      [1, 1],
      [0.5, 0.5],
    ] as const) {
      const s = unitToSvg(ux, uy, size, pad)
      const back = svgToUnit(s.x, s.y, size, pad)
      expect(back.x).toBeCloseTo(ux, 6)
      expect(back.y).toBeCloseTo(uy, 6)
    }
  })

  it("maps (0,0) to bottom-left and (1,1) to top-right", () => {
    const s0 = unitToSvg(0, 0, 100, 10)
    expect(s0.x).toBeCloseTo(10, 6)
    expect(s0.y).toBeCloseTo(90, 6)
    const s1 = unitToSvg(1, 1, 100, 10)
    expect(s1.x).toBeCloseTo(90, 6)
    expect(s1.y).toBeCloseTo(10, 6)
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

describe("clipReturnsToDefault", () => {
  it("is ON when unset, so every clip releases unless it opts out", () => {
    // Drafts saved before the release existed carry no flag; they release too.
    expect(clipReturnsToDefault(clip())).toBe(true)
  })

  it("passes an explicit choice through", () => {
    expect(clipReturnsToDefault(clip({ returnToDefault: true }))).toBe(true)
    expect(clipReturnsToDefault(clip({ returnToDefault: false }))).toBe(false)
  })
})

describe("clipReleaseMs", () => {
  it("is 0 only when the clip opts out of releasing", () => {
    expect(clipReleaseMs(clip({ returnToDefault: false }))).toBe(0)
  })

  it("mirrors the clip's window when it releases at full speed", () => {
    expect(clipReleaseMs(clip({ durationMs: 1200 }))).toBe(1200)
  })

  it("mirrors the ACTIVE duration, so speed shortens the release too", () => {
    const fast = clip({ durationMs: 5000, speed: 5 })
    expect(clipReleaseMs(fast)).toBe(effectiveActiveMs(fast))
    expect(clipReleaseMs(fast)).toBe(1000)
  })
})

describe("clipReleaseEase", () => {
  it("pins the endpoints so the release starts at the pose and lands on rest", () => {
    const ease = clipReleaseEase(clip({ easing: "linear" }))
    expect(ease(0)).toBeCloseTo(0, 6)
    expect(ease(1)).toBeCloseTo(1, 6)
  })

  it("uses the clip's own curve", () => {
    expect(clipReleaseEase(clip({ easing: "linear" }))(0.5)).toBeCloseTo(0.5, 6)
    expect(clipReleaseEase(clip({ easing: "out" }))(0.5)).toBeCloseTo(0.875, 6)
  })

  it("drops the speed remap — speed already shortened the release window", () => {
    const fast = clip({ easing: "linear", speed: 4 })
    expect(clipProgressEase(fast)(0.5)).toBeCloseTo(1, 6)
    expect(clipReleaseEase(fast)(0.5)).toBeCloseTo(0.5, 6)
  })

  it("clamps progress outside 0..1", () => {
    const ease = clipReleaseEase(clip({ easing: "linear" }))
    expect(ease(-1)).toBeCloseTo(0, 6)
    expect(ease(2)).toBeCloseTo(1, 6)
  })
})
