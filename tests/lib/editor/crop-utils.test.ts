import { describe, expect, it } from "vitest"

import {
  computeCoverCropRegion,
  computeCoverCropRegionForAspect,
  CROP_ANIMATION_VARS,
  CROP_FIT_ORIGIN_VAR,
  CROP_FIT_SX_VAR,
  CROP_SHELL_W_VAR,
  CROP_VIEW_BOX_VAR,
  cropMediaObjectStyle,
  cropObjectMetrics,
  cropOriginCss,
  cropRegionRatio,
  cropRegionMatchesAspect,
  cropViewBoxValue,
  croppedNaturalSize,
  insetCropRegion,
  isActiveCropRegion,
  objectViewBoxCropStyle,
  supportsObjectViewBox,
  videoCropMediaStyle,
} from "@/lib/editor/crop-utils"

describe("crop utils", () => {
  it("computes side crops for wide images in narrow containers", () => {
    expect(computeCoverCropRegion(2000, 1000, 1, 1)).toEqual({
      x: 25,
      y: 0,
      width: 50,
      height: 100,
    })
  })

  it("computes top-anchored vertical crops for browser frame captures", () => {
    expect(computeCoverCropRegionForAspect(1000, 2000, 1, "top")).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    })
  })

  it("insets crop regions while preserving top anchoring when requested", () => {
    expect(
      insetCropRegion({ x: 0, y: 0, width: 100, height: 50 }, 0.8, "top")
    ).toEqual({ x: 10, y: 0, width: 80, height: 40 })
  })

  it("checks whether a crop region matches the requested aspect", () => {
    expect(
      cropRegionMatchesAspect(
        { x: 25, y: 0, width: 50, height: 100 },
        2000,
        1000,
        1
      )
    ).toBe(true)
    expect(
      cropRegionMatchesAspect(
        { x: 0, y: 0, width: 100, height: 100 },
        2000,
        1000,
        1
      )
    ).toBe(false)
  })

  it("builds absolute media styles that fill an overflow crop frame", () => {
    expect(
      cropMediaObjectStyle({ x: 25, y: 10, width: 50, height: 80 })
    ).toEqual({
      position: "absolute",
      width: "var(--crop-w, 200%)",
      height: "var(--crop-h, 125%)",
      left: "var(--crop-left, -50%)",
      top: "var(--crop-top, -12.5%)",
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "fill",
    })
  })

  // The animated-crop vars carry bare values; the styles wrap them as fallbacks.
  it("exposes bare crop metrics for the animation player to write", () => {
    expect(cropObjectMetrics({ x: 25, y: 10, width: 50, height: 80 })).toEqual({
      width: "200%",
      height: "125%",
      left: "-50%",
      top: "-12.5%",
    })
    expect(cropViewBoxValue({ x: 10, y: 20, width: 40, height: 50 })).toBe(
      "inset(20% 50% 30% 10%)"
    )
  })

  it("treats near-full regions as inactive crops", () => {
    expect(isActiveCropRegion({ x: 0, y: 0, width: 100, height: 100 })).toBe(
      false
    )
    expect(isActiveCropRegion({ x: 10, y: 0, width: 80, height: 100 })).toBe(
      true
    )
  })

  it("scales natural size by the crop percentages", () => {
    expect(
      croppedNaturalSize(2000, 1000, { x: 25, y: 0, width: 50, height: 100 })
    ).toEqual({ w: 1000, h: 1000 })
  })

  it("picks object-view-box styles when native support is available", () => {
    const region = { x: 10, y: 20, width: 40, height: 50 }
    expect(objectViewBoxCropStyle(region)).toEqual({
      objectViewBox: "var(--crop-view-box, inset(20% 50% 30% 10%))",
    })
    expect(videoCropMediaStyle(region, true)).toEqual(
      objectViewBoxCropStyle(region)
    )
    expect(videoCropMediaStyle(region, false)).toEqual(
      cropMediaObjectStyle(region)
    )
  })

  it("reports object-view-box support as a boolean", () => {
    expect(typeof supportsObjectViewBox()).toBe("boolean")
  })
})

describe("animated crop fit helpers", () => {
  it("derives the window's ratio from the region AND the natural size", () => {
    // Half-width of a 1920x1080 source is 960x1080 → 8:9, not the source's 16:9.
    expect(
      cropRegionRatio({ x: 0, y: 0, width: 50, height: 100 }, 1920, 1080)
    ).toBeCloseTo(960 / 1080, 6)
    // A square window on a wide source really is square.
    expect(
      cropRegionRatio({ x: 0, y: 0, width: 56.25, height: 100 }, 1920, 1080)
    ).toBeCloseTo(1, 3)
  })

  it("returns null for a degenerate region rather than a bogus ratio", () => {
    expect(
      cropRegionRatio({ x: 0, y: 0, width: 0, height: 50 }, 100, 100)
    ).toBe(null)
    expect(cropRegionRatio({ x: 0, y: 0, width: 50, height: 50 }, 0, 100)).toBe(
      null
    )
  })

  it("pivots a fit scale on the window's centre", () => {
    expect(cropOriginCss({ x: 20, y: 10, width: 40, height: 60 })).toBe(
      "40% 40%"
    )
    expect(cropOriginCss({ x: 0, y: 0, width: 100, height: 100 })).toBe(
      "50% 50%"
    )
  })

  it("clears every crop var it can set", () => {
    // A var left behind would keep cropping after the effect is removed.
    for (const name of [
      CROP_VIEW_BOX_VAR,
      CROP_SHELL_W_VAR,
      CROP_FIT_SX_VAR,
      CROP_FIT_ORIGIN_VAR,
    ]) {
      expect(CROP_ANIMATION_VARS).toContain(name)
    }
  })
})
