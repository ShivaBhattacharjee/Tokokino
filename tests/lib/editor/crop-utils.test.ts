import { describe, expect, it } from "vitest"

import {
  computeCoverCropRegion,
  computeCoverCropRegionForAspect,
  cropMediaObjectStyle,
  cropRegionMatchesAspect,
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
      width: "200%",
      height: "125%",
      left: "-50%",
      top: "-12.5%",
      maxWidth: "none",
      maxHeight: "none",
      objectFit: "fill",
    })
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
      objectViewBox: "inset(20% 50% 30% 10%)",
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
