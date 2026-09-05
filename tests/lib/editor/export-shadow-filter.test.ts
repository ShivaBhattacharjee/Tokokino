import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * WebKit rasterizes a foreignObject without painting the screenshot's
 * box-shadow, so a frameless canvas exported from Safari lost its shadow while
 * the live editor showed it. The export clone re-expresses it as the
 * drop-shadow chain WebKit does raster.
 */

const supportsObjectViewBox = vi.fn<() => boolean>()

vi.mock("@/lib/editor/crop-utils", () => ({
  supportsObjectViewBox: () => supportsObjectViewBox(),
}))

const { redirectBoxShadowToFilter } =
  await import("@/lib/editor/export-shadow-filter")

/** jsdom returns inline styles from getComputedStyle, which is all we need. */
function cloneWith(style: Partial<CSSStyleDeclaration>): HTMLElement {
  const node = document.createElement("div")
  const target = document.createElement("img")
  target.setAttribute("data-editor-shadow-box-target", "")
  Object.assign(target.style, style)
  node.appendChild(target)
  document.body.appendChild(node)
  return node
}

const targetOf = (node: HTMLElement) =>
  node.querySelector<HTMLElement>("[data-editor-shadow-box-target]")!

describe("redirectBoxShadowToFilter", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    supportsObjectViewBox.mockReturnValue(false)
  })

  it("moves the shadow onto the filter chain on WebKit", () => {
    const node = cloneWith({
      boxShadow: "rgba(95, 137, 122, 0.247) 7.2px 7.2px 0.8px 0px",
    })
    redirectBoxShadowToFilter(node)

    const el = targetOf(node)
    expect(el.style.boxShadow).toBe("none")
    expect(el.style.filter).toContain("--editor-shadow-filter-preview")
    expect(el.style.filter).toContain("drop-shadow(7.2px 7.2px 0.8px")
  })

  it("keeps every layer of a multi-layer shadow", () => {
    const node = cloneWith({
      boxShadow:
        "rgba(0, 0, 0, 0.6) 7.2px 7.2px 0.8px 0px, rgba(0, 0, 0, 0.4) 14.4px 14.4px 0.8px 0px, rgba(0, 0, 0, 0.2) 21.6px 21.6px 0.8px 0px",
    })
    redirectBoxShadowToFilter(node)

    expect(targetOf(node).style.filter.match(/drop-shadow\(/g)).toHaveLength(3)
  })

  it("preserves the colour grade already on the filter", () => {
    const node = cloneWith({
      boxShadow: "rgba(0, 0, 0, 0.5) 4px 4px 8px 0px",
      filter: "var(--editor-media-fx, brightness(1.1))",
    })
    redirectBoxShadowToFilter(node)

    const filter = targetOf(node).style.filter
    expect(filter.startsWith("var(--editor-media-fx, brightness(1.1))")).toBe(
      true
    )
    expect(filter).toContain("drop-shadow(")
  })

  it("leaves Chromium's box-shadow alone", () => {
    supportsObjectViewBox.mockReturnValue(true)
    const node = cloneWith({
      boxShadow: "rgba(0, 0, 0, 0.5) 4px 4px 8px 0px",
    })
    redirectBoxShadowToFilter(node)

    expect(targetOf(node).style.boxShadow).not.toBe("none")
    expect(targetOf(node).style.filter).toBe("")
  })

  it("does nothing when the screenshot has no shadow", () => {
    const node = cloneWith({ filter: "brightness(1.1)" })
    redirectBoxShadowToFilter(node)

    // A var() leg with an empty fallback would invalidate the whole chain and
    // take the colour grade down with it.
    expect(targetOf(node).style.filter).toBe("brightness(1.1)")
  })
})
