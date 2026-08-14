import { afterEach, describe, expect, it, vi } from "vitest"

import {
  alphaSample,
  opaquePct,
} from "@/lib/editor/animation-export/video-media/frame-canvas-utils"

describe("frame opacity sampling efficiency", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reads a bounded sample instead of the full 4K canvas", () => {
    const source = document.createElement("canvas")
    source.width = 3840
    source.height = 2160

    const sourceGetImageData = vi.fn(() => ({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    }))
    const samplePixels = new Uint8ClampedArray(128 * 80 * 4)
    for (let i = 3; i < samplePixels.length; i += 4) samplePixels[i] = 255
    const sampleGetImageData = vi.fn(() => ({ data: samplePixels }))
    const sampleDrawImage = vi.fn()

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        if (this === source) {
          return {
            getImageData: sourceGetImageData,
          } as unknown as CanvasRenderingContext2D
        }
        return {
          drawImage: sampleDrawImage,
          getImageData: sampleGetImageData,
        } as unknown as CanvasRenderingContext2D
      }
    )

    expect(opaquePct(source)).toBe(100)
    expect(sourceGetImageData).not.toHaveBeenCalled()
    expect(sampleDrawImage).toHaveBeenCalledWith(source, 0, 0, 128, 80)
    expect(sampleGetImageData).toHaveBeenCalledWith(0, 0, 128, 80)
  })

  it("keeps faint sparse foreground pixels visible to the retry scorer", () => {
    const source = document.createElement("canvas")
    source.width = 3840
    source.height = 2160
    const samplePixels = new Uint8ClampedArray(128 * 80 * 4)
    samplePixels[3] = 1

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        if (this === source) return {} as CanvasRenderingContext2D
        return {
          drawImage: vi.fn(),
          getImageData: () => ({ data: samplePixels }),
        } as unknown as CanvasRenderingContext2D
      }
    )

    expect(opaquePct(source)).toBeGreaterThan(0)
  })

  it("changes the settle signature while opaque RGB pixels are decoding", () => {
    const source = document.createElement("canvas")
    source.width = 3840
    source.height = 2160
    const first = new Uint8ClampedArray(128 * 80 * 4).fill(255)
    const second = first.slice()
    second[0] = 10
    let pixels = first

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        if (this === source) return {} as CanvasRenderingContext2D
        return {
          drawImage: vi.fn(),
          getImageData: () => ({ data: pixels }),
        } as unknown as CanvasRenderingContext2D
      }
    )

    const before = alphaSample(source).signature
    pixels = second
    expect(alphaSample(source).signature).not.toBe(before)
  })
})
