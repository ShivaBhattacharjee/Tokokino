import { describe, expect, it } from "vitest"

import {
  DEFAULT_LINEAR_GRADIENT,
  backgroundCategoryIcon,
  buildLinearGradient,
  gradientCategoryIcon,
  normalizeGradientColors,
  parseLinearGradient,
  withGradientOptions,
} from "@/components/editor/inspector/background-section-parts/constants"

/**
 * Pure gradient helpers extracted in the background-section refactor. These
 * parse/build CSS `linear-gradient(...)` strings and back the gradient
 * customizer, so a regression here silently corrupts saved backgrounds.
 */
describe("parseLinearGradient", () => {
  it("parses angle and colors from a valid gradient", () => {
    const result = parseLinearGradient(
      "linear-gradient(120deg, #fff, #000, #f00)"
    )
    expect(result).toEqual({ angle: 120, colors: ["#fff", "#000", "#f00"] })
  })

  it("strips trailing color stop percentages", () => {
    const result = parseLinearGradient(
      "linear-gradient(90deg, #fff 0%, #000 100%, #f00 50%)"
    )
    expect(result?.colors).toEqual(["#fff", "#000", "#f00"])
  })

  it("falls back to the default angle when none is present", () => {
    const result = parseLinearGradient("linear-gradient(#fff, #000, #f00)")
    expect(result?.angle).toBe(DEFAULT_LINEAR_GRADIENT.angle)
  })

  it("handles negative angles", () => {
    const result = parseLinearGradient(
      "linear-gradient(-45deg, #fff, #000, #f00)"
    )
    expect(result?.angle).toBe(-45)
  })

  it("returns null for a non-linear-gradient string", () => {
    expect(parseLinearGradient("radial-gradient(#fff, #000)")).toBeNull()
    expect(parseLinearGradient("#fff")).toBeNull()
  })

  it("returns null when there are fewer than two colors", () => {
    expect(parseLinearGradient("linear-gradient(90deg, #fff)")).toBeNull()
  })

  it("does not split commas inside nested color functions", () => {
    const result = parseLinearGradient(
      "linear-gradient(90deg, rgb(255, 0, 0), rgb(0, 0, 255))"
    )
    expect(result?.colors).toEqual(["rgb(255, 0, 0)", "rgb(0, 0, 255)"])
  })
})

describe("normalizeGradientColors", () => {
  it("truncates colors longer than the target length", () => {
    expect(normalizeGradientColors(["#a", "#b", "#c"], 2)).toEqual(["#a", "#b"])
  })

  it("pads short lists by repeating the last color", () => {
    expect(normalizeGradientColors(["#a"], 3)).toEqual(["#a", "#a", "#a"])
  })

  it("uses the default colors when given an empty list", () => {
    // An empty input seeds the full default palette (truncation only applies
    // to non-empty inputs), so all default colors come through.
    expect(normalizeGradientColors([], 2)).toEqual(
      DEFAULT_LINEAR_GRADIENT.colors
    )
  })
})

describe("buildLinearGradient", () => {
  it("rounds the angle and joins colors", () => {
    expect(
      buildLinearGradient({ angle: 134.6, colors: ["#fff", "#000"] })
    ).toBe("linear-gradient(135deg, #fff, #000)")
  })

  it("round-trips through parseLinearGradient", () => {
    const built = buildLinearGradient({ angle: 90, colors: ["#fff", "#000"] })
    expect(parseLinearGradient(built)).toEqual({
      angle: 90,
      colors: ["#fff", "#000"],
    })
  })
})

describe("withGradientOptions", () => {
  it("builds option ids from the prefix and index, applying overrides", () => {
    const options = withGradientOptions({
      values: ["v0", "v1"],
      valuePrefix: "warm",
      overrides: { "warm-1": "custom" },
    })
    expect(options).toEqual([
      { id: "warm-0", baseValue: "v0", value: "v0" },
      { id: "warm-1", baseValue: "v1", value: "custom" },
    ])
  })
})

describe("category icon resolvers", () => {
  it("returns distinct icons for known gradient categories and a default", () => {
    expect(gradientCategoryIcon("warm")).not.toBe(gradientCategoryIcon("cool"))
    expect(typeof gradientCategoryIcon("unknown-key")).toBe("function")
  })

  it("returns a function icon for known and unknown background categories", () => {
    expect(typeof backgroundCategoryIcon("mesh")).toBe("function")
    expect(typeof backgroundCategoryIcon("unknown-key")).toBe("function")
  })
})
