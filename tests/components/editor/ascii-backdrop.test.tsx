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
import {
  DEFAULT_BACKDROP_ASCII,
  setAsciiResolutionPreview,
} from "@/lib/editor/ascii-backdrop"
import { CanvasScope } from "@/lib/editor/store"

let resize: ResizeObserverCallback | null = null

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resize = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function parseGlyphSvg(image: HTMLImageElement | null): Document {
  const source = image?.getAttribute("src") ?? ""
  const encodedSvg = source.slice(source.indexOf(",") + 1)
  return new DOMParser().parseFromString(
    decodeURIComponent(encodedSvg),
    "image/svg+xml"
  )
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
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
    // The plane is always exactly canvas-sized: nothing scales a stale grid.
    expect(image?.style.width).toBe("200px")
    expect(image?.style.height).toBe("100px")
    expect(image?.style.transform).toBe("")

    const svgDocument = parseGlyphSvg(image)
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

  it("resamples the grid at the resolution a drag is previewing", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    const { container } = render(
      <CanvasScope id="canvas-1">
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
      </CanvasScope>
    )

    await act(async () => {
      resize?.(
        [{ contentRect: { width: 200, height: 100 } } as ResizeObserverEntry],
        {} as ResizeObserver
      )
    })

    const glyphs = () =>
      container.querySelector<HTMLImageElement>(
        'img[data-export-ascii-glyphs="true"]'
      )
    expect(parseGlyphSvg(glyphs()).querySelectorAll("text")).toHaveLength(5)

    // Twice the columns is twice the rows — a real resample, not a scaled grid,
    // so the drag can never show a different density than the commit will.
    await act(async () => {
      setAsciiResolutionPreview("canvas-1", 40)
      await nextFrame()
    })
    const previewed = parseGlyphSvg(glyphs())
    expect(previewed.querySelectorAll("text")).toHaveLength(10)
    expect(previewed.documentElement.getAttribute("viewBox")).toBe(
      "0 0 200 100"
    )
    expect(glyphs()?.style.width).toBe("200px")

    await act(async () => {
      setAsciiResolutionPreview("canvas-1", null)
      await nextFrame()
    })
    expect(parseGlyphSvg(glyphs()).querySelectorAll("text")).toHaveLength(5)
  })
})
