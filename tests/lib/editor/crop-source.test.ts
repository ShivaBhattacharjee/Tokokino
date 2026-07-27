import { describe, expect, it } from "vitest"

import { __testing } from "@/lib/editor/crop-source"

const { MAX_OUTPUT_PIXELS, outputSize, regionToPixels } = __testing

describe("regionToPixels", () => {
  it("maps a percent region onto source pixels", () => {
    expect(regionToPixels({ x: 25, y: 50, width: 50, height: 25 }, 800, 400)) //
      .toEqual({ sx: 200, sy: 200, sw: 400, sh: 100 })
  })

  it("keeps the rect inside the image when the region overruns it", () => {
    // Percent crops come back from the cropper as floats and can round a pixel
    // past the edge; drawing from outside the source yields transparent bands.
    const rect = regionToPixels(
      { x: 90, y: 90, width: 20, height: 20 },
      100,
      100
    )
    expect(rect).toEqual({ sx: 90, sy: 90, sw: 10, sh: 10 })
  })

  it("rejects a region that lands on less than a pixel", () => {
    expect(
      regionToPixels({ x: 0, y: 0, width: 0, height: 50 }, 800, 400)
    ).toBeNull()
    expect(
      regionToPixels({ x: 100, y: 0, width: 10, height: 50 }, 800, 400)
    ).toBeNull()
  })
})

describe("outputSize", () => {
  it("renders a normal crop at full resolution", () => {
    expect(outputSize(2400, 1600)).toEqual({
      width: 2400,
      height: 1600,
      scaled: false,
    })
  })

  it("shrinks a crop that would exceed the canvas pixel cap", () => {
    // A tall scrolling capture: the browser hands back a blank bitmap instead
    // of erroring when the canvas is too big, so the crop must be clamped.
    const size = outputSize(4000, 30000)
    expect(size.scaled).toBe(true)
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_OUTPUT_PIXELS)
    // Aspect ratio survives the clamp.
    expect(size.width / size.height).toBeCloseTo(4000 / 30000, 3)
  })
})
