import { describe, expect, it } from "vitest"

import {
  ASCII_CHARSETS,
  ASCII_CELL_ASPECT,
  asciiPlateColor,
  asciiRowCount,
  DEFAULT_BACKDROP_ASCII,
  gridFromImageData,
  isAsciiBackdropActive,
  resolveBackdropAscii,
  sampleBackgroundPixels,
  waitForAsciiBackdrops,
} from "@/lib/editor/ascii-backdrop"
import type { Background } from "@/lib/editor/state-types"

function pixels(colors: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flat())
}

describe("ascii backdrop grid", () => {
  it("maps dark pixels to the sparse end of the ramp and bright ones to the dense end", () => {
    const ramp = ASCII_CHARSETS.standard
    const grid = gridFromImageData(
      pixels([
        [0, 0, 0, 255],
        [255, 255, 255, 255],
      ]),
      2,
      1,
      { charset: "standard", inverted: false, colored: false }
    )
    expect(grid.chars).toBe(`${ramp[0]}${ramp[ramp.length - 1]}`)
  })

  it("reverses the ramp when inverted", () => {
    const ramp = ASCII_CHARSETS.standard
    const grid = gridFromImageData(
      pixels([
        [0, 0, 0, 255],
        [255, 255, 255, 255],
      ]),
      2,
      1,
      { charset: "standard", inverted: true, colored: false }
    )
    expect(grid.chars).toBe(`${ramp[ramp.length - 1]}${ramp[0]}`)
  })

  it("treats transparent pixels as dark regardless of their rgb", () => {
    const grid = gridFromImageData(pixels([[255, 255, 255, 0]]), 1, 1, {
      charset: "standard",
      inverted: false,
      colored: false,
    })
    expect(grid.chars).toBe(ASCII_CHARSETS.standard[0])
  })

  it("emits one quantized colour per cell only when coloured", () => {
    const source = pixels([
      [200, 10, 10, 255],
      [201, 11, 11, 255],
    ])
    const colored = gridFromImageData(source, 2, 1, {
      charset: "blocks",
      inverted: false,
      colored: true,
    })
    expect(colored.colors).toHaveLength(2)
    // Near-identical neighbours quantize to one value so runs can merge.
    expect(colored.colors[0]).toBe(colored.colors[1])

    const mono = gridFromImageData(source, 2, 1, {
      charset: "blocks",
      inverted: false,
      colored: false,
    })
    expect(mono.colors).toHaveLength(0)
  })

  it("fills the grid for every charset", () => {
    for (const charset of Object.keys(
      ASCII_CHARSETS
    ) as (keyof typeof ASCII_CHARSETS)[]) {
      const grid = gridFromImageData(
        pixels([
          [0, 0, 0, 255],
          [128, 128, 128, 255],
          [255, 255, 255, 255],
          [64, 64, 64, 255],
        ]),
        2,
        2,
        { charset, inverted: false, colored: false }
      )
      expect(grid.chars).toHaveLength(4)
      expect(
        [...grid.chars].every((c) => ASCII_CHARSETS[charset].includes(c))
      ).toBe(true)
    }
  })
})

describe("ascii plate colour", () => {
  it("darkens the darkest sampled tone so the glyphs read against it", () => {
    const plate = asciiPlateColor(
      pixels([
        [200, 200, 200, 255],
        [40, 60, 100, 255],
      ]),
      2
    )
    expect(plate).toBe("rgb(22,33,55)")
  })

  it("treats transparent samples as black rather than their rgb", () => {
    expect(asciiPlateColor(pixels([[255, 255, 255, 0]]), 1)).toBe("rgb(0,0,0)")
  })
})

describe("ascii backdrop layout", () => {
  it("derives rows from the aspect ratio, not the pixel size", () => {
    expect(asciiRowCount(80, 1600, 900)).toBe(asciiRowCount(80, 800, 450))
  })

  it("keeps cells twice as tall as they are wide", () => {
    const cols = 100
    const width = 1000
    const height = 1000
    const rows = asciiRowCount(cols, width, height)
    const cellAspect = width / cols / (height / rows)
    expect(cellAspect).toBeCloseTo(ASCII_CELL_ASPECT, 5)
  })

  it("never returns zero rows for a rendered canvas", () => {
    expect(asciiRowCount(200, 500, 4)).toBe(1)
    expect(asciiRowCount(80, 0, 0)).toBe(0)
  })
})

describe("ascii backdrop state", () => {
  it("fills missing fields from the defaults on legacy drafts", () => {
    expect(resolveBackdropAscii(undefined)).toEqual(DEFAULT_BACKDROP_ASCII)
    expect(
      resolveBackdropAscii({ enabled: true, charset: "blocks" } as never)
    ).toMatchObject({
      enabled: true,
      charset: "blocks",
      resolution: DEFAULT_BACKDROP_ASCII.resolution,
    })
  })

  it("stays inactive without a background to sample", () => {
    const none: Background = { type: "none", value: "" }
    const gradient: Background = {
      type: "gradient",
      value: "linear-gradient(#000,#fff)",
    }
    expect(
      isAsciiBackdropActive({ ...DEFAULT_BACKDROP_ASCII, enabled: true }, none)
    ).toBe(false)
    expect(
      isAsciiBackdropActive(
        { ...DEFAULT_BACKDROP_ASCII, enabled: true },
        gradient
      )
    ).toBe(true)
    expect(isAsciiBackdropActive(undefined, gradient)).toBe(false)
  })
})

describe("waitForAsciiBackdrops", () => {
  it("resolves straight away when nothing is sampling", async () => {
    let done = false
    await waitForAsciiBackdrops().then(() => {
      done = true
    })
    expect(done).toBe(true)
  })

  it("does not resolve until an in-flight sample has settled", async () => {
    const order: string[] = []
    // jsdom has no 2d context, so this settles fast — the point is that the
    // wait observes it at all. Export clones the DOM the instant this resolves,
    // so a wait that races the sample would clone a backdrop with no glyphs.
    const sample = sampleBackgroundPixels(
      { type: "gradient", value: "linear-gradient(#000,#fff)" },
      4,
      2
    ).then(() => order.push("sample"))
    const wait = waitForAsciiBackdrops().then(() => order.push("wait"))

    await Promise.all([sample, wait])
    expect(order).toEqual(["sample", "wait"])
  })

  it("waits for a sample queued while an earlier one was settling", async () => {
    const order: string[] = []
    const bg: Background = { type: "solid", value: "#0a0a0a" }

    const first = sampleBackgroundPixels(bg, 4, 2).then(() => {
      order.push("first")
      // A resolution change mid-wait queues another sample; returning before
      // it settles would hand the exporter the half-updated grid.
      return sampleBackgroundPixels(bg, 8, 4).then(() => order.push("second"))
    })
    const wait = waitForAsciiBackdrops().then(() => order.push("wait"))

    await Promise.all([first, wait])
    expect(order).toEqual(["first", "second", "wait"])
  })
})
