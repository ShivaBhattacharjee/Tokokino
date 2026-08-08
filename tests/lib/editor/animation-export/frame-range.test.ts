import { describe, expect, it, vi } from "vitest"

import {
  canvasLevels,
  decodedNeedsRangeExpansion,
  expandLimitedRange,
} from "@/lib/editor/animation-export/video-media/frame-range"

/** `canvasLevels` reads every 13th pixel, so each value has to fill a run. */
const RUN = 13

/**
 * jsdom has no 2D context, so these fake just enough of one: a canvas backed by
 * an RGBA buffer the helpers read and write through getImageData/putImageData.
 * Each supplied colour fills one sampling run, so all of them get measured.
 */
function fakeCanvas(pixels: number[][]): HTMLCanvasElement {
  const width = pixels.length * RUN
  const data = new Uint8ClampedArray(width * 4)
  pixels.forEach(([r, g, b], i) => {
    for (let k = 0; k < RUN; k++) {
      const at = (i * RUN + k) * 4
      data[at] = r
      data[at + 1] = g
      data[at + 2] = b
      data[at + 3] = 255
    }
  })
  const image = { data, width, height: 1 }
  const ctx = {
    getImageData: () => image,
    putImageData: (next: { data: Uint8ClampedArray }) => {
      data.set(next.data)
    },
    drawImage: vi.fn(),
  }
  return {
    width,
    height: 1,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
}

/** The RGB triple at the head of each run — one per colour originally given. */
const pixelsOf = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d")!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const out: number[][] = []
  for (let i = 0; i < data.length; i += 4 * RUN) {
    out.push([data[i], data[i + 1], data[i + 2]])
  }
  return out
}

const grey = (v: number) => [v, v, v]

describe("canvasLevels", () => {
  it("reports the luma floor and ceiling", () => {
    const levels = canvasLevels(fakeCanvas([grey(16), grey(120), grey(235)]))
    expect(levels?.black).toBeCloseTo(16, 0)
    expect(levels?.white).toBeCloseTo(235, 0)
  })

  it("returns null when nothing is opaque enough to measure", () => {
    expect(canvasLevels(fakeCanvas([]))).toBeNull()
  })
})

describe("expandLimitedRange", () => {
  it("stretches studio swing back to full range", () => {
    const canvas = fakeCanvas([grey(16), grey(235)])
    expandLimitedRange(canvas)
    const [black, white] = pixelsOf(canvas)
    expect(black).toEqual([0, 0, 0])
    expect(white.every((c) => c >= 254)).toBe(true)
  })

  it("keeps mid grey near the middle", () => {
    const canvas = fakeCanvas([grey(126)])
    expandLimitedRange(canvas)
    // (126 − 16) · 255/219 = 128.1
    expect(pixelsOf(canvas)[0][0]).toBeCloseTo(128, -1)
  })

  it("clamps rather than wrapping below studio black", () => {
    const canvas = fakeCanvas([grey(0), grey(8)])
    expandLimitedRange(canvas)
    expect(pixelsOf(canvas).map((p) => p[0])).toEqual([0, 0])
  })

  it("leaves alpha untouched", () => {
    const canvas = fakeCanvas([grey(100)])
    expandLimitedRange(canvas)
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, 1, 1)
    expect(data[3]).toBe(255)
  })
})

describe("decodedNeedsRangeExpansion", () => {
  const fullRange = fakeCanvas([grey(0), grey(128), grey(255)])
  const studioSwing = fakeCanvas([grey(16), grey(128), grey(235)])

  it("detects a studio-swing decode against a full-range reference", () => {
    expect(decodedNeedsRangeExpansion(studioSwing, fullRange)).toBe(true)
  })

  it("leaves a correct engine alone", () => {
    expect(decodedNeedsRangeExpansion(fullRange, fullRange)).toBe(false)
  })

  it("does not fire when both paths agree on studio swing", () => {
    // The source itself is lifted — the export is faithful and must not be
    // "corrected" into crushed blacks.
    expect(decodedNeedsRangeExpansion(studioSwing, studioSwing)).toBe(false)
  })

  it("does not fire on a dark frame that simply has no true blacks", () => {
    const noBlacks = fakeCanvas([grey(64), grey(120), grey(200)])
    const reference = fakeCanvas([grey(64), grey(120), grey(200)])
    expect(decodedNeedsRangeExpansion(noBlacks, reference)).toBe(false)
  })

  it("does not fire when the floor is above studio black by chance", () => {
    // A 40-level floor is not studio black, however it compares to the
    // reference — expanding here would wreck the frame.
    const lifted = fakeCanvas([grey(40), grey(128), grey(220)])
    expect(decodedNeedsRangeExpansion(lifted, fullRange)).toBe(false)
  })

  it("declines to guess when a canvas cannot be measured", () => {
    expect(decodedNeedsRangeExpansion(studioSwing, fakeCanvas([]))).toBe(false)
    expect(decodedNeedsRangeExpansion(fakeCanvas([]), fullRange)).toBe(false)
  })

  it("round-trips: a detected frame expands to match the reference", () => {
    const decoded = fakeCanvas([grey(16), grey(235)])
    expect(decodedNeedsRangeExpansion(decoded, fullRange)).toBe(true)
    expandLimitedRange(decoded)
    const levels = canvasLevels(decoded)
    expect(levels?.black).toBeCloseTo(0, 0)
    expect(levels?.white).toBeGreaterThanOrEqual(254)
    expect(decodedNeedsRangeExpansion(decoded, fullRange)).toBe(false)
  })
})
