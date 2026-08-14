import { afterEach, describe, expect, it, vi } from "vitest"

import { shouldProxyAssetUrl } from "@/lib/editor/export-assets"
import {
  INITIAL_SETTLE_PROGRESS,
  advanceSettle,
  exportElementLayoutSize,
  exportScaleStyle,
  isRasterEssentiallyEmpty,
  rasterSignatureDelta,
  settleDelayMs,
  signatureCoverage,
} from "@/lib/editor/export"

describe("shouldProxyAssetUrl", () => {
  it("proxies external http and https assets", () => {
    expect(shouldProxyAssetUrl("https://images.example.com/a.png")).toBe(true)
    expect(shouldProxyAssetUrl("http://images.example.com/a.png")).toBe(true)
  })

  it("does not proxy same-origin or local asset values", () => {
    expect(shouldProxyAssetUrl("http://localhost:3000/logo.png")).toBe(false)
    expect(shouldProxyAssetUrl("/logo.png")).toBe(false)
    expect(shouldProxyAssetUrl("#mask")).toBe(false)
    expect(shouldProxyAssetUrl("data:image/png;base64,abc")).toBe(false)
    expect(shouldProxyAssetUrl("blob:http://localhost:3000/id")).toBe(false)
  })
})

describe("exportScaleStyle — WebKit foreignObject scaling", () => {
  it("scales via transform and keeps the layout box at its rendered size", () => {
    // The box must stay 1128×634 so cqw/cqh and percentage geometry resolve
    // against what the editor laid out; only the paint is scaled.
    expect(exportScaleStyle(1128, 634, 3840 / 1128)).toEqual({
      width: "1128px",
      height: "634px",
      transform: `scale(${3840 / 1128})`,
      transformOrigin: "0 0",
    })
  })

  it("anchors the scale at the top-left so the box maps onto the SVG origin", () => {
    // A centred origin would shift the scene off the raster by half the growth.
    expect(exportScaleStyle(800, 600, 2).transformOrigin).toBe("0 0")
  })

  it("is identity at 1×, where HD exports already worked", () => {
    const style = exportScaleStyle(1920, 1080, 1)
    expect(style.transform).toBe("scale(1)")
    expect(style.width).toBe("1920px")
  })
})

describe("isRasterEssentiallyEmpty", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function rasterWithAlpha(alphaFor: (index: number) => number) {
    const size = 32 * 32
    const data = new Uint8ClampedArray(size * 4)
    for (let i = 0; i < size; i++) data[i * 4 + 3] = alphaFor(i)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data }),
    } as unknown as CanvasRenderingContext2D)
    return document.createElement("canvas")
  }

  it("flags a WebKit capture that dropped everything but the watermark", () => {
    // ~0.6% of the frame covered — the signature of Safari painting the SVG
    // before its subresources decoded.
    const canvas = rasterWithAlpha((i) => (i < 6 ? 255 : 0))
    expect(isRasterEssentiallyEmpty(canvas)).toBe(true)
  })

  it("keeps a transparent-background composition with real content", () => {
    const canvas = rasterWithAlpha((i) => (i % 4 === 0 ? 255 : 0))
    expect(isRasterEssentiallyEmpty(canvas)).toBe(false)
  })

  it("treats an unavailable 2d context as not empty", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    expect(isRasterEssentiallyEmpty(document.createElement("canvas"))).toBe(
      false
    )
  })
})

describe("rasterSignatureDelta — WebKit raster settling", () => {
  it("reports zero for two identical rasters", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    const b = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    expect(rasterSignatureDelta(a, b)).toBe(0)
  })

  it("separates a raster missing a layer from the settled one", () => {
    // A dropped background leaves a large area at a different value; the mean
    // must clear the 1.5 threshold two consecutive rasters are compared against.
    const settled = new Uint8ClampedArray(64).fill(180)
    const missing = new Uint8ClampedArray(64).fill(0)
    expect(rasterSignatureDelta(settled, missing)).toBeGreaterThan(1.5)
  })

  it("stays under the threshold for antialiasing-level jitter", () => {
    const a = new Uint8ClampedArray(64).fill(180)
    const b = new Uint8ClampedArray(64).fill(180)
    b[0] = 190
    b[7] = 171
    expect(rasterSignatureDelta(a, b)).toBeLessThan(1.5)
  })

  it("treats an unreadable signature as maximally different", () => {
    expect(rasterSignatureDelta(null, new Uint8ClampedArray(4))).toBe(255)
    expect(
      rasterSignatureDelta(new Uint8ClampedArray(4), new Uint8ClampedArray(8))
    ).toBe(255)
  })
})

describe("signatureCoverage — WebKit raster completeness", () => {
  /** One 32×32 signature: `colorFor` returns [r,g,b,a] per pixel. */
  function signature(colorFor: (index: number) => number[]) {
    const pixels = 32 * 32
    const data = new Uint8ClampedArray(pixels * 4)
    for (let i = 0; i < pixels; i++) {
      const [r, g, b, a] = colorFor(i)
      data.set([r, g, b, a], i * 4)
    }
    return data
  }

  it("ranks a complete raster above one that dropped the screenshot", () => {
    // Safari's partial capture: the background and chrome painted opaque, but
    // the largest data URI never decoded, so the frame is flat where the
    // screenshot should be.
    const complete = signature((i) => [i % 251, (i * 7) % 251, i % 97, 255])
    const missingScreenshot = signature((i) =>
      i < 200 ? [i % 251, (i * 7) % 251, i % 97, 255] : [10, 10, 12, 255]
    )
    expect(signatureCoverage(complete)).toBeGreaterThan(
      signatureCoverage(missingScreenshot)
    )
  })

  it("ranks an opaque raster above one that dropped its background", () => {
    const opaque = signature(() => [20, 20, 20, 255])
    const transparent = signature((i) => [20, 20, 20, i < 256 ? 255 : 0])
    expect(signatureCoverage(opaque)).toBeGreaterThan(
      signatureCoverage(transparent)
    )
  })

  it("treats an unreadable signature as worse than any raster", () => {
    expect(signatureCoverage(null)).toBeLessThan(
      signatureCoverage(signature(() => [0, 0, 0, 0]))
    )
  })
})

describe("advanceSettle — WebKit raster settling", () => {
  /** Run a sequence of sampled coverages, reporting when it settled. */
  function run(samples: { coverage: number; unchanged: boolean }[]) {
    let progress = INITIAL_SETTLE_PROGRESS
    let bestAt = -1
    for (const [index, sample] of samples.entries()) {
      const next = advanceSettle(progress, sample)
      progress = {
        bestCoverage: next.bestCoverage,
        improved: next.improved,
        confirmations: next.confirmations,
      }
      if (next.take) bestAt = index
      if (next.done) return { doneAt: index, bestAt }
    }
    return { doneAt: -1, bestAt }
  }

  it("never settles on a raster that only ever repeated itself", () => {
    // WebKit reproduces an incomplete capture exactly — the export was landing
    // on the screenshot-less raster because two identical draws read as settled.
    const broken = { coverage: 0.92, unchanged: true }
    expect(
      run([{ coverage: 0.92, unchanged: false }, broken, broken, broken])
    ).toEqual({ doneAt: -1, bestAt: 0 })
  })

  it("settles once coverage rose and then held", () => {
    // The real sequence: incomplete, background lands, screenshot lands, holds.
    const { doneAt, bestAt } = run([
      { coverage: 0.92, unchanged: false },
      { coverage: 1.22, unchanged: false },
      { coverage: 1.39, unchanged: false },
      { coverage: 1.39, unchanged: true },
      { coverage: 1.39, unchanged: true },
    ])
    expect(doneAt).toBe(4)
    expect(bestAt).toBe(2)
  })

  it("keeps sampling while the raster is still changing", () => {
    const { doneAt } = run([
      { coverage: 0.92, unchanged: false },
      { coverage: 1.39, unchanged: false },
      { coverage: 1.39, unchanged: false },
      { coverage: 1.39, unchanged: false },
    ])
    expect(doneAt).toBe(-1)
  })

  it("keeps the best raster when a later one comes back worse", () => {
    const { doneAt, bestAt } = run([
      { coverage: 0.92, unchanged: false },
      { coverage: 1.39, unchanged: false },
      { coverage: 0.92, unchanged: false },
      { coverage: 1.2, unchanged: false },
      { coverage: 1.2, unchanged: true },
      { coverage: 1.2, unchanged: true },
    ])
    expect(bestAt).toBe(1)
    expect(doneAt).toBe(5)
  })
})

describe("settleDelayMs", () => {
  it("keeps the first retries short, where captures usually settle", () => {
    expect(settleDelayMs(2)).toBe(20)
    expect(settleDelayMs(3)).toBe(40)
    expect(settleDelayMs(4)).toBe(80)
  })

  it("backs off steeply once the quick retries have not helped", () => {
    // A stuck decode only recovers with time; the old flat schedule gave the
    // whole run two thirds of a second regardless of how heavy the canvas was.
    expect(settleDelayMs(5)).toBeGreaterThan(settleDelayMs(4))
    expect(settleDelayMs(6)).toBeGreaterThan(settleDelayMs(5))
    const total = [2, 3, 4, 5, 6, 7, 8].reduce(
      (sum, attempt) => sum + settleDelayMs(attempt),
      0
    )
    expect(total).toBeGreaterThan(1000)
  })

  it("caps a single wait so one export cannot stall indefinitely", () => {
    expect(settleDelayMs(12)).toBe(400)
    expect(settleDelayMs(40)).toBe(400)
  })
})

describe("exportElementLayoutSize", () => {
  it("reads explicit SVG dimensions when offsetWidth is unavailable", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "1128")
    svg.setAttribute("height", "634")

    expect(exportElementLayoutSize(svg)).toEqual({ width: 1128, height: 634 })
  })
})
