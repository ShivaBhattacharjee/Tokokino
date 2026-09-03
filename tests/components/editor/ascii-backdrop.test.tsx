import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type * as AsciiBackdropModule from "@/lib/editor/ascii-backdrop"

vi.mock("@/lib/editor/ascii-backdrop", async (importOriginal) => {
  const actual = await importOriginal<typeof AsciiBackdropModule>()
  return {
    ...actual,
    isWebKitEngine: vi.fn(() => false),
    sampleBackgroundPixels: vi.fn(
      async (_background: unknown, cols: number, rows: number) => {
        const data = new Uint8ClampedArray(cols * rows * 4)
        for (let i = 0; i < data.length; i += 4) {
          const even = (i / 4) % 2 === 0
          data[i] = even ? 255 : 0
          data[i + 1] = 0
          data[i + 2] = even ? 0 : 255
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
  isWebKitEngine,
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

function parseGlyphSvg(glyphs: HTMLElement | null): Document {
  const mask = glyphs?.style.maskImage ?? ""
  const source = mask.match(/url\(["']?(data:[^)"']+)["']?\)/)?.[1] ?? ""
  const encodedSvg = source.slice(source.indexOf(",") + 1)
  return new DOMParser().parseFromString(
    decodeURIComponent(encodedSvg),
    "image/svg+xml"
  )
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

describe("AsciiBackdrop SVG mask", () => {
  afterEach(() => {
    resize = null
    vi.mocked(isWebKitEngine).mockReturnValue(false)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("renders fixed-cell rows inside one row-bounded SVG mask", async () => {
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

    const glyphs = container.querySelector<HTMLElement>(
      '[data-export-ascii-glyphs="true"]'
    )
    expect(glyphs).not.toBeNull()
    expect(container.querySelector("svg")).toBeNull()

    const svgDocument = parseGlyphSvg(glyphs)
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

  it("keeps source-coloured 200-column grids to one SVG node per row", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    const { container } = render(
      <AsciiBackdrop
        background={{ type: "gradient", value: "linear-gradient(red, blue)" }}
        ascii={{
          ...DEFAULT_BACKDROP_ASCII,
          enabled: true,
          resolution: 200,
          colored: true,
        }}
      />
    )

    await act(async () => {
      resize?.(
        [
          {
            contentRect: { width: 1600, height: 900 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      )
    })

    const glyphs = container.querySelector<HTMLElement>(
      '[data-export-ascii-glyphs="true"]'
    )
    const svgDocument = parseGlyphSvg(glyphs)
    expect(svgDocument.querySelectorAll("text")).toHaveLength(56)
    expect(glyphs?.style.background).toContain("linear-gradient")
    expect(glyphs?.style.webkitMaskImage).toBe(glyphs?.style.maskImage)
  })

  it("uses a flat canvas preview on WebKit and keeps the vector layer for export", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver)
    vi.mocked(isWebKitEngine).mockReturnValue(true)
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 200 })),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
      putImageData: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as never
    )

    const { container } = render(
      <AsciiBackdrop
        background={{ type: "gradient", value: "linear-gradient(red, blue)" }}
        ascii={{
          ...DEFAULT_BACKDROP_ASCII,
          enabled: true,
          resolution: 200,
          colored: true,
        }}
      />
    )

    await act(async () => {
      resize?.(
        [
          {
            contentRect: { width: 1600, height: 900 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      )
    })

    const raster = container.querySelector<HTMLCanvasElement>(
      'canvas[data-export-hidden="true"]'
    )
    const vector = container.querySelector<HTMLElement>(
      '[data-export-ascii-vector="true"]'
    )
    expect(raster).not.toBeNull()
    expect(raster?.width).toBe(1600)
    expect(raster?.height).toBe(900)
    expect(vector?.style.display).toBe("none")
    expect(context.fillText).toHaveBeenCalledTimes(56)
    expect(context.drawImage).toHaveBeenCalledOnce()
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
      container.querySelector<HTMLElement>('[data-export-ascii-glyphs="true"]')
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

    await act(async () => {
      setAsciiResolutionPreview("canvas-1", null)
      await nextFrame()
    })
    expect(parseGlyphSvg(glyphs()).querySelectorAll("text")).toHaveLength(5)
  })
})
