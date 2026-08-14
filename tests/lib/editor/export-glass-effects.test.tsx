import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  useCanvasPreviewMode: () => false,
}))

import { GlassFrame } from "@/components/ui/glass-frame"
import { neutralizeUnsupportedExportBackdropFilters } from "@/lib/editor/export"

describe("export glass backdrop filters", () => {
  it("replaces Glass Cascade blur with medium frost on the export clone only", () => {
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
      expect(layer.style.background).not.toContain("0.96")
    }
    for (const layer of clonedLayers) {
      expect(layer.style.backdropFilter).toBe("none")
      expect(layer.style.background).toContain("0.96")
      expect(layer.style.background).toContain("132, 145, 161")
    }
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
