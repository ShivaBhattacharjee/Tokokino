import { describe, expect, it } from "vitest"

import {
  coverContainerBox,
  fitContainBox,
} from "@/components/editor/canvas/helpers"

/**
 * The contain fit used by both video contain paths. The cropped one especially:
 * the crop polyfill scales the `<video>` by percentages of its shell, so if the
 * shell's rendered ratio drifts from the crop's ratio the picture shears — which
 * is exactly what `width:100% + max-height:100% + aspect-ratio` did.
 */
describe("fitContainBox", () => {
  it("is width-bound when the box is taller than the ratio", () => {
    // 400x400 stage, 2:1 content → full width, half height.
    expect(fitContainBox(400, 400, 2)).toEqual({ width: 400, height: 200 })
  })

  it("is height-bound when the box is wider than the ratio", () => {
    // 400x100 stage, 1:1 content → limited by height.
    expect(fitContainBox(400, 100, 1)).toEqual({ width: 100, height: 100 })
  })

  it("fills exactly when the ratios match", () => {
    expect(fitContainBox(1920, 1080, 1920 / 1080)).toEqual({
      width: 1920,
      height: 1080,
    })
  })

  it("always returns a box of the requested ratio", () => {
    for (const [w, h, ratio] of [
      [800, 600, 2.35],
      [500, 900, 0.5],
      [1000, 1000, 1.777],
      [320, 240, 9 / 16],
    ] as const) {
      const box = fitContainBox(w, h, ratio)
      expect(box.width / box.height).toBeCloseTo(ratio, 6)
      // ...and never overflows the box it was fitted into.
      expect(box.width).toBeLessThanOrEqual(w + 1e-9)
      expect(box.height).toBeLessThanOrEqual(h + 1e-9)
    }
  })

  it("handles a tall crop inside a wide stage without overflowing", () => {
    // The regression: a 9:16 crop on a 16:9 stage. The old CSS kept width at
    // 100% and clamped height, so the box came out wider than 9:16 and sheared.
    const box = fitContainBox(1600, 900, 9 / 16)
    expect(box.height).toBeCloseTo(900, 6)
    expect(box.width).toBeCloseTo(506.25, 6)
    expect(box.width / box.height).toBeCloseTo(9 / 16, 6)
  })
})

describe("coverContainerBox", () => {
  it("overflows width when the box is narrower than the ratio", () => {
    // 400x400 box, 2:1 content → must be 800 wide to cover.
    expect(coverContainerBox(400, 400, 2)).toEqual({ width: 800, height: 400 })
  })

  it("overflows height when the box is wider than the ratio", () => {
    expect(coverContainerBox(400, 100, 1)).toEqual({ width: 400, height: 400 })
  })

  it("always covers the box and keeps the requested ratio", () => {
    for (const [w, h, ratio] of [
      [800, 600, 2.35],
      [500, 900, 0.5],
      [1000, 1000, 1.777],
      [320, 240, 9 / 16],
    ] as const) {
      const box = coverContainerBox(w, h, ratio)
      expect(box.width / box.height).toBeCloseTo(ratio, 6)
      expect(box.width).toBeGreaterThanOrEqual(w - 1e-9)
      expect(box.height).toBeGreaterThanOrEqual(h - 1e-9)
    }
  })

  it("produces a scale that restores the crop ratio on a stretched shell", () => {
    // The regression: a 9:16 crop mapped onto a 16:9 shell. Scaling by
    // cover/shell must bring the effective ratio back to the crop's.
    const shellW = 1600
    const shellH = 900
    const ratio = 9 / 16
    const cover = coverContainerBox(shellW, shellH, ratio)
    const sx = cover.width / shellW
    const sy = cover.height / shellH
    expect((shellW * sx) / (shellH * sy)).toBeCloseTo(ratio, 6)
    // Cover never shrinks below the shell on either axis.
    expect(sx).toBeGreaterThanOrEqual(1)
    expect(sy).toBeGreaterThanOrEqual(1)
  })
})
