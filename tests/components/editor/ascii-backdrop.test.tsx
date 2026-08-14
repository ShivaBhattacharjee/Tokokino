import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type * as AsciiBackdropModule from "@/lib/editor/ascii-backdrop"

vi.mock("@/lib/editor/ascii-backdrop", async (importOriginal) => {
  const actual = await importOriginal<typeof AsciiBackdropModule>()
  return {
    ...actual,
    sampleBackgroundPixels: vi.fn(
      async (_background: unknown, cols: number, rows: number) => {
        const data = new Uint8ClampedArray(cols * rows * 4)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255
          data[i + 1] = 255
          data[i + 2] = 255
          data[i + 3] = 255
        }
        return data
      }
    ),
  }
})

import { AsciiBackdrop } from "@/components/editor/canvas/ascii-backdrop"
import { DEFAULT_BACKDROP_ASCII } from "@/lib/editor/ascii-backdrop"

let resize: ResizeObserverCallback | null = null

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resize = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("AsciiBackdrop SVG image", () => {
  afterEach(() => {
    resize = null
    vi.unstubAllGlobals()
  })

  it("renders fixed-cell rows inside one SVG-backed image", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    const { container } = render(
      <AsciiBackdrop
        background={{ type: "solid", value: "#fff" }}
        ascii={{
          ...DEFAULT_BACKDROP_ASCII,
          enabled: true,
          resolution: 20,
          charset: "stars",
          colored: false,
        }}
      />
    )

    await act(async () => {
      resize?.(
        [
          {
            contentRect: { width: 200, height: 100 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      )
    })

    const image = container.querySelector<HTMLImageElement>(
      'img[data-export-ascii-glyphs="true"]'
    )
    expect(image).not.toBeNull()
    expect(container.querySelector("svg")).toBeNull()

    const source = image?.getAttribute("src") ?? ""
    const encodedSvg = source.slice(source.indexOf(",") + 1)
    const svgDocument = new DOMParser().parseFromString(
      decodeURIComponent(encodedSvg),
      "image/svg+xml"
    )
    const svg = svgDocument.documentElement
    const rows = Array.from(svgDocument.querySelectorAll("text"))
    expect(svg.getAttribute("viewBox")).toBe("0 0 200 100")
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row.getAttribute("x")).toBe("0")
      expect(row.getAttribute("textLength")).toBe("200")
      expect(row.getAttribute("lengthAdjust")).toBe("spacingAndGlyphs")
    }
  })
})
