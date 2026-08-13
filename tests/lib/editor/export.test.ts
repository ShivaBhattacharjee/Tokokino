import { describe, expect, it } from "vitest"

import { shouldProxyAssetUrl } from "@/lib/editor/export-assets"
import { exportElementLayoutSize, exportScaleStyle } from "@/lib/editor/export"

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

describe("exportElementLayoutSize", () => {
  it("reads explicit SVG dimensions when offsetWidth is unavailable", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "1128")
    svg.setAttribute("height", "634")

    expect(exportElementLayoutSize(svg)).toEqual({ width: 1128, height: 634 })
  })
})
