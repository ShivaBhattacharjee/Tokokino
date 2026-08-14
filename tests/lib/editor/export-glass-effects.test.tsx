import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  useCanvasPreviewMode: () => false,
}))

import { GlassFrame } from "@/components/ui/glass-frame"
import {
  elementRotation,
  flattenGlassChromeRing,
  neutralizeUnsupportedExportBackdropFilters,
} from "@/lib/editor/export"

describe("export glass backdrop filters", () => {
  it("removes Glass Cascade backdrop blur from the export clone only", () => {
    const { container } = render(
      <GlassFrame frameId="glass-stack" colorMode="dark" imageSrc="shot.png" />
    )
    const source = container.firstElementChild as HTMLElement
    const clone = source.cloneNode(true) as HTMLElement

    neutralizeUnsupportedExportBackdropFilters(clone)

    const sourceLayers = Array.from(
      source.querySelectorAll<HTMLElement>("[data-glass-frame-layer]")
    ).filter((layer) => layer.dataset.glassFrameLayer !== "chrome")
    const clonedLayers = Array.from(
      clone.querySelectorAll<HTMLElement>("[data-glass-frame-layer]")
    ).filter((layer) => layer.dataset.glassFrameLayer !== "chrome")

    expect(sourceLayers).toHaveLength(3)
    expect(clonedLayers).toHaveLength(3)
    for (const layer of sourceLayers) {
      expect(layer.style.backdropFilter).toBe("blur(18px) saturate(135%)")
    }
    // The authored translucent paint has to survive: substituting an opaque
    // approximation for it turned the exported panes into solid slate cards.
    clonedLayers.forEach((layer, index) => {
      expect(layer.style.backdropFilter).toBe("none")
      expect(layer.style.background).toBe(sourceLayers[index].style.background)
      expect(layer.style.background).toContain("rgba(255, 255, 255, 0.13)")
    })
  })

  it("leaves non-glass backdrop and foreground filters unchanged", () => {
    const root = document.createElement("div")
    const background = document.createElement("div")
    background.style.backdropFilter = "blur(4px)"
    background.style.filter = "opacity(0.46)"
    root.appendChild(background)

    neutralizeUnsupportedExportBackdropFilters(root)

    expect(background.style.backdropFilter).toBe("blur(4px)")
    expect(background.style.filter).toBe("opacity(0.46)")
  })
})

describe("flattenGlassChromeRing", () => {
  function chromeWithShadow(boxShadow: string) {
    const root = document.createElement("div")
    const chrome = document.createElement("div")
    chrome.dataset.glassFrameLayer = "chrome"
    chrome.style.boxShadow = boxShadow
    root.appendChild(chrome)
    document.body.appendChild(root)
    return { root, chrome }
  }

  it("redraws the sub-pixel inset ring as a border of the same width", () => {
    const { root, chrome } = chromeWithShadow(
      "rgba(255, 255, 255, 0.32) 0px 0px 0px 0.9835px inset"
    )

    flattenGlassChromeRing(root)

    expect(chrome.style.boxShadow).toBe("none")
    expect(chrome.style.borderWidth).toBe("0.9835px")
    expect(chrome.style.borderStyle).toBe("solid")
    expect(chrome.style.borderColor).toBe("rgba(255, 255, 255, 0.32)")
    // The sheen has to keep spanning the rect the shadow covered.
    expect(chrome.style.backgroundOrigin).toBe("border-box")
    root.remove()
  })

  it("leaves an outset or offset shadow alone", () => {
    const outset = chromeWithShadow("rgba(0, 0, 0, 0.4) 0px 8px 24px 0px")
    flattenGlassChromeRing(outset.root)
    expect(outset.chrome.style.boxShadow).toBe(
      "rgba(0, 0, 0, 0.4) 0px 8px 24px 0px"
    )
    expect(outset.chrome.style.borderStyle).toBe("")
    outset.root.remove()

    const offsetInset = chromeWithShadow(
      "rgba(0, 0, 0, 0.4) 2px 2px 0px 1px inset"
    )
    flattenGlassChromeRing(offsetInset.root)
    expect(offsetInset.chrome.style.borderStyle).toBe("")
    offsetInset.root.remove()
  })

  it("ignores glass panes that are not the chrome layer", () => {
    const root = document.createElement("div")
    const pane = document.createElement("div")
    pane.dataset.glassFrameLayer = "front"
    pane.style.boxShadow = "rgba(255, 255, 255, 0.32) 0px 0px 0px 1px inset"
    root.appendChild(pane)
    document.body.appendChild(root)

    flattenGlassChromeRing(root)

    expect(pane.style.boxShadow).toBe(
      "rgba(255, 255, 255, 0.32) 0px 0px 0px 1px inset"
    )
    root.remove()
  })
})

describe("elementRotation — glass frost sampling", () => {
  function withTransform(transform: string) {
    const el = document.createElement("div")
    el.style.transform = transform
    return el
  }

  it("reads the pane's rotation so its frost samples the right region", () => {
    const radians = (12 * Math.PI) / 180
    const el = withTransform(
      `matrix(${Math.cos(radians)}, ${Math.sin(radians)}, ` +
        `${-Math.sin(radians)}, ${Math.cos(radians)}, 0, 0)`
    )
    expect(elementRotation(el)).toBeCloseTo(radians, 6)
  })

  it("keeps the sign of a counter-clockwise pane", () => {
    const radians = (-8 * Math.PI) / 180
    const el = withTransform(
      `matrix(${Math.cos(radians)}, ${Math.sin(radians)}, ` +
        `${-Math.sin(radians)}, ${Math.cos(radians)}, 0, 0)`
    )
    expect(elementRotation(el)).toBeCloseTo(radians, 6)
  })

  it("reads matrix3d, which is what translateZ(0) rotate() resolves to", () => {
    const radians = (6 * Math.PI) / 180
    const el = withTransform(
      `matrix3d(${Math.cos(radians)}, ${Math.sin(radians)}, 0, 0, ` +
        `${-Math.sin(radians)}, ${Math.cos(radians)}, 0, 0, ` +
        `0, 0, 1, 0, 0, 0, 0, 1)`
    )
    expect(elementRotation(el)).toBeCloseTo(radians, 6)
  })

  it("treats an unrotated or unparseable transform as square", () => {
    expect(elementRotation(withTransform("none"))).toBe(0)
    expect(elementRotation(document.createElement("div"))).toBe(0)
  })
})
