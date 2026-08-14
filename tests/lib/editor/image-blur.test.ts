import { describe, expect, it } from "vitest"

import { blurRgba, saturateRgba } from "@/lib/editor/image-blur"

/** Solid RGBA field, so a test can state only the pixels it cares about. */
function field(
  width: number,
  height: number,
  colorFor: (x: number, y: number) => number[]
) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(colorFor(x, y), (y * width + x) * 4)
    }
  }
  return data
}

const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4))

describe("blurRgba", () => {
  it("leaves a flat field untouched", () => {
    const data = field(24, 24, () => [40, 60, 90, 255])
    blurRgba(data, 24, 24, 4)
    // Edge included: clamped sampling means the border averages itself.
    expect(pixel(data, 24, 0, 0)).toEqual([40, 60, 90, 255])
    expect(pixel(data, 24, 12, 12)).toEqual([40, 60, 90, 255])
  })

  it("spreads a hard edge across the blur radius", () => {
    const width = 48
    const data = field(width, 8, (x) =>
      x < width / 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]
    )
    blurRgba(data, width, 8, 6)

    // The seam lands mid-grey and the transition is monotonic outward.
    const seam = pixel(data, width, 24, 4)[0]
    expect(seam).toBeGreaterThan(90)
    expect(seam).toBeLessThan(165)
    expect(pixel(data, width, 18, 4)[0]).toBeLessThan(seam)
    expect(pixel(data, width, 30, 4)[0]).toBeGreaterThan(seam)
    // Far from the seam the field is untouched — this is a blur, not a fade.
    expect(pixel(data, width, 0, 4)[0]).toBe(0)
    expect(pixel(data, width, width - 1, 4)[0]).toBe(255)
  })

  it("does not drag colour out of fully transparent pixels", () => {
    // Unpremultiplied blurring pulls the transparent side's colour into the
    // opaque one; a frost over an empty canvas would darken at its edges.
    const width = 32
    const data = field(width, 8, (x) =>
      x < width / 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]
    )
    blurRgba(data, width, 8, 5)

    const [r, g, b, a] = pixel(data, width, 14, 4)
    expect(a).toBeLessThan(255)
    expect(a).toBeGreaterThan(0)
    expect(r).toBeGreaterThan(240)
    expect(g).toBe(0)
    expect(b).toBe(0)
  })

  it("ignores a non-positive sigma or an undersized buffer", () => {
    const data = field(8, 8, () => [10, 20, 30, 255])
    const copy = data.slice()
    blurRgba(data, 8, 8, 0)
    expect(data).toEqual(copy)
    blurRgba(data, 64, 64, 3)
    expect(data).toEqual(copy)
  })
})

describe("saturateRgba", () => {
  it("leaves pixels alone at 1", () => {
    const data = new Uint8ClampedArray([120, 40, 200, 255])
    saturateRgba(data, 1)
    expect(Array.from(data)).toEqual([120, 40, 200, 255])
  })

  it("pushes a colour further from its luminance", () => {
    const data = new Uint8ClampedArray([120, 40, 200, 255])
    const before = data.slice()
    saturateRgba(data, 1.35)
    expect(data[1]).toBeLessThan(before[1])
    expect(data[2]).toBeGreaterThan(before[2])
    expect(data[3]).toBe(255)
  })

  it("leaves grey grey", () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255])
    saturateRgba(data, 1.35)
    expect(data[0]).toBeCloseTo(128, 0)
    expect(data[1]).toBeCloseTo(128, 0)
    expect(data[2]).toBeCloseTo(128, 0)
  })
})
