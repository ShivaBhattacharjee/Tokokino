import { describe, expect, it } from "vitest"

import {
  ASCII_CHARSETS,
  ASCII_CELL_ASPECT,
  ASCII_MAX_CELLS,
  ASCII_MAX_OPACITY,
  ASCII_MIN_OPACITY,
  ASCII_MIN_RESOLUTION,
  ASCII_RESOLUTION_PREVIEW_VAR,
  asciiGridSize,
  asciiImageCoverRect,
  asciiPlateColor,
  asciiResolutionPreviewTransform,
  asciiRowCount,
  asciiRunGeometry,
  asciiSamplingSurfaceSize,
  DEFAULT_BACKDROP_ASCII,
  gridFromImageData,
  isAsciiBackdropActive,
  normalizeAsciiOpacity,
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

  it("samples a landscape background at the aspect represented by tall glyph cells", () => {
    // 100×31 grid cells are 1 unit wide × 2 units tall, so the background
    // surface they represent is 100×62. Sampling at 100×31 instead makes
    // background-size: cover crop a different region than the canvas.
    expect(asciiSamplingSurfaceSize(100, 31)).toEqual({
      width: 100,
      height: 62,
    })
  })

  it("preserves the represented aspect for portrait and one-row grids", () => {
    expect(asciiSamplingSurfaceSize(45, 80)).toEqual({
      width: 45,
      height: 160,
    })
    expect(asciiSamplingSurfaceSize(20, 1)).toEqual({
      width: 20,
      height: 2,
    })
  })

  it("cover-crops an image against the represented canvas aspect", () => {
    // A 400×300 image sampled for a 100×31 grid uses the grid's represented
    // 100×62 surface. The old square-pixel 100×31 surface cropped to only 124px
    // high and visibly moved the source beneath a transparent ASCII layer.
    const [x, y, width, height] = asciiImageCoverRect(400, 300, 100, 31)
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(26, 0)
    expect(width).toBeCloseTo(400, 5)
    expect(height).toBeCloseTo(248, 0)
  })

  it("assigns every glyph run an exact cell-based x position and width", () => {
    // Unicode stars/circles can fall through to a different font inside an
    // exported foreignObject. Geometry must therefore come from the grid, not
    // from whichever advance width that fallback font reports.
    expect(asciiRunGeometry(0, 12, 8)).toEqual({ x: 0, width: 96 })
    expect(asciiRunGeometry(12, 5, 8)).toEqual({ x: 96, width: 40 })
  })

  it("normalizes invalid run geometry without producing negative SVG lengths", () => {
    expect(asciiRunGeometry(-3, -4, 0)).toEqual({ x: 0, width: 0 })
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
      opacity: DEFAULT_BACKDROP_ASCII.opacity,
    })
  })

  it("clamps a persisted opacity outside the schema's range", () => {
    expect(resolveBackdropAscii({ opacity: 140 } as never).opacity).toBe(
      ASCII_MAX_OPACITY
    )
    expect(resolveBackdropAscii({ opacity: -4 } as never).opacity).toBe(
      ASCII_MIN_OPACITY
    )
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
  // Must stay the first test that touches the module's sampling state: it
  // asserts the never-sampled path, which no later sample can restore.
  it("resolves straight away when nothing has ever sampled", async () => {
    let done = false
    await waitForAsciiBackdrops().then(() => {
      done = true
    })
    expect(done).toBe(true)
  })

  it("still waits for a paint after the last sample has settled", async () => {
    // The pending set empties an earlier microtask than the setPixels that
    // draws the result, so an empty set is not proof the glyphs are in the DOM.
    // Export reads the painted DOM, so the commit wait has to run anyway.
    await sampleBackgroundPixels({ type: "solid", value: "#111" }, 4, 2)
    // Drain the microtasks that retire the tracking entry, so the pending set
    // is genuinely empty here — the exact state the early return keyed on.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const order: string[] = []
    const frame = new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        order.push("frame")
        resolve()
      })
    )
    const wait = waitForAsciiBackdrops().then(() => order.push("wait"))

    await Promise.all([frame, wait])
    expect(order).toEqual(["frame", "wait"])
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

describe("asciiGridSize", () => {
  it("leaves a landscape canvas at its requested resolution", () => {
    const { cols, rows } = asciiGridSize(200, 1600, 900)
    expect(cols).toBe(200)
    expect(cols * rows).toBeLessThanOrEqual(ASCII_MAX_CELLS)
  })

  it("trims columns on a tall canvas, where rows multiply the cell count", () => {
    // 200 columns on 9:16 is ~36k cells before the budget, and Animate mode
    // mounts one grid per ASCII/background/filter keyframe.
    const unbounded = 200 * asciiRowCount(200, 900, 1600)
    expect(unbounded).toBeGreaterThan(ASCII_MAX_CELLS)

    const { cols, rows } = asciiGridSize(200, 900, 1600)
    expect(cols).toBeLessThan(200)
    expect(cols * rows).toBeLessThanOrEqual(ASCII_MAX_CELLS)
  })

  it("never trims below the minimum resolution", () => {
    const { cols } = asciiGridSize(200, 10, 40000)
    expect(cols).toBeGreaterThanOrEqual(ASCII_MIN_RESOLUTION)
  })
})

describe("normalizeAsciiOpacity", () => {
  it("clamps and rounds anything the UI or a draft can hand it", () => {
    expect(normalizeAsciiOpacity(-8)).toBe(ASCII_MIN_OPACITY)
    expect(normalizeAsciiOpacity(140)).toBe(ASCII_MAX_OPACITY)
    expect(normalizeAsciiOpacity(66.4)).toBe(66)
    expect(normalizeAsciiOpacity(Number.NaN)).toBe(
      DEFAULT_BACKDROP_ASCII.opacity
    )
  })
})

describe("asciiResolutionPreviewTransform", () => {
  it("scales the painted grid against the live-preview var", () => {
    expect(asciiResolutionPreviewTransform(90, 90)).toBe(
      `scale(calc(90 / var(${ASCII_RESOLUTION_PREVIEW_VAR}, 90)))`
    )
    // Stale sample after a commit: keep the drag scale until resample lands.
    expect(asciiResolutionPreviewTransform(90, 140)).toBe(
      `scale(calc(90 / var(${ASCII_RESOLUTION_PREVIEW_VAR}, 140)))`
    )
  })
})
