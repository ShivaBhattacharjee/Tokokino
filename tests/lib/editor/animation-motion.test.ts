import { describe, expect, it } from "vitest"

import {
  composeTransformAtTime,
  transformToCss,
  type SampledTransform,
} from "@/lib/editor/animation-motion"

const identity: SampledTransform = {
  opacity: 1,
  scale: 1,
  x: 0,
  y: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  blur: 0,
}

const make = (over: Partial<SampledTransform>): SampledTransform => ({
  ...identity,
  ...over,
})

describe("transformToCss", () => {
  it("emits transform:none and filter:none for an identity transform", () => {
    const css = transformToCss(identity)
    expect(css.transform).toBe("none")
    expect(css.opacity).toBe("1")
    expect(css.filter).toBe("none")
  })

  it("emits translate/scale/rotate parts in order", () => {
    const css = transformToCss(make({ x: 10, y: -5, scale: 0.5, rotate: 30 }))
    expect(css.transform).toBe("translate(10%, -5%) scale(0.5) rotate(30deg)")
  })

  it("prepends perspective when rotateX or rotateY is present", () => {
    const css = transformToCss(make({ rotateX: 15 }))
    expect(css.transform).toBe("perspective(900px) rotateX(15deg)")
    const css2 = transformToCss(make({ rotateY: -20 }))
    expect(css2.transform).toBe("perspective(900px) rotateY(-20deg)")
  })

  it("rounds numeric values to 3 decimal places", () => {
    const css = transformToCss(make({ x: 1.23456, scale: 0.98765 }))
    expect(css.transform).toBe("translate(1.235%, 0%) scale(0.988)")
  })

  it("serializes opacity as a rounded string", () => {
    expect(transformToCss(make({ opacity: 0.123456 })).opacity).toBe("0.123")
  })

  it("emits a blur filter only above the 0.01px threshold", () => {
    expect(transformToCss(make({ blur: 0.005 })).filter).toBe("none")
    expect(transformToCss(make({ blur: 4 })).filter).toBe("blur(4px)")
  })

  it("scales blur by blurScale for high-resolution export frames", () => {
    expect(transformToCss(make({ blur: 4 }), 2).filter).toBe("blur(8px)")
  })
})

describe("composeTransformAtTime", () => {
  it("returns the base transform when there are no clips", () => {
    expect(composeTransformAtTime([], 0)).toEqual(identity)
  })

  it("holds progress 0 (fully hidden start pose) before a clip starts", () => {
    const t = composeTransformAtTime([{ startMs: 1000, durationMs: 1000 }], 0)
    // At p=0 the motion keyframes give opacity 0, scale 0.82, y 14, blur 10.
    expect(t.opacity).toBeCloseTo(0, 5)
    expect(t.scale).toBeCloseTo(0.82, 5)
    expect(t.y).toBeCloseTo(14, 5)
    expect(t.blur).toBeCloseTo(10, 5)
  })

  it("holds progress 1 (settled pose) after a clip ends", () => {
    const t = composeTransformAtTime([{ startMs: 0, durationMs: 1000 }], 5000)
    expect(t.opacity).toBeCloseTo(1, 5)
    expect(t.scale).toBeCloseTo(1, 5)
    expect(t.y).toBeCloseTo(0, 5)
    expect(t.blur).toBeCloseTo(0, 5)
  })

  it("skips zero- and negative-duration clips", () => {
    expect(
      composeTransformAtTime([{ startMs: 0, durationMs: 0 }], 500)
    ).toEqual(identity)
    expect(
      composeTransformAtTime([{ startMs: 0, durationMs: -100 }], 500)
    ).toEqual(identity)
  })

  it("composes scale/opacity multiplicatively across overlapping clips", () => {
    // Two identical clips both fully at their start pose (progress 0):
    // scale 0.82 * 0.82, opacity 0 * 0.
    const clips = [
      { startMs: 1000, durationMs: 1000 },
      { startMs: 1000, durationMs: 1000 },
    ]
    const t = composeTransformAtTime(clips, 0)
    expect(t.scale).toBeCloseTo(0.82 * 0.82, 5)
    expect(t.opacity).toBeCloseTo(0, 5)
  })

  it("composes translation and blur additively across overlapping clips", () => {
    const clips = [
      { startMs: 1000, durationMs: 1000 },
      { startMs: 1000, durationMs: 1000 },
    ]
    const t = composeTransformAtTime(clips, 0)
    // y 14 + 14, blur 10 + 10 at both clips' start pose.
    expect(t.y).toBeCloseTo(28, 5)
    expect(t.blur).toBeCloseTo(20, 5)
  })

  it("a settled clip is a no-op in composition (multiplies by 1, adds 0)", () => {
    // One finished clip (progress 1) plus one at-start clip (progress 0) equals
    // just the at-start clip's contribution.
    const both = composeTransformAtTime(
      [
        { startMs: 0, durationMs: 1000 }, // finished at t=2000
        { startMs: 2000, durationMs: 1000 }, // not started at t=2000
      ],
      2000
    )
    const onlyStart = composeTransformAtTime(
      [{ startMs: 2000, durationMs: 1000 }],
      2000
    )
    expect(both.scale).toBeCloseTo(onlyStart.scale, 5)
    expect(both.opacity).toBeCloseTo(onlyStart.opacity, 5)
    expect(both.y).toBeCloseTo(onlyStart.y, 5)
    expect(both.blur).toBeCloseTo(onlyStart.blur, 5)
  })
})
