import { describe, expect, it } from "vitest"

import { buildScreenshotImageStyle } from "@/lib/editor/screenshot-visual"
import type { ResolvedScreenshotStyle } from "@/lib/editor/store/canvas-helpers"
import type { BackdropLighting, Border, Shadow } from "@/lib/editor/state-types"

const noBorder: Border = { color: null, width: 0, style: "solid", padding: 0 }
const redBorder: Border = {
  color: "#ff0000",
  width: 4,
  style: "solid",
  padding: 0,
}
const noShadow: Shadow = {
  type: "none",
  intensity: 0,
  lightSource: "center",
  color: "#000000",
}
const lighting: BackdropLighting = {
  target: "outer",
} as BackdropLighting

const baseStyle = (overrides: Partial<ResolvedScreenshotStyle> = {}) =>
  ({
    tilt: { rx: 4, ry: 8, rz: 12 },
    scale: 150,
    shadow: noShadow,
    border: noBorder,
    borderRadius: 20,
    padding: 24,
    lighting,
    objectFit: "cover",
    ...overrides,
  }) satisfies ResolvedScreenshotStyle

describe("buildScreenshotImageStyle", () => {
  it("drives the live transform through the given var namespace", () => {
    const main = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      borderAnimated: false,
    })
    expect(main.transform).toContain("--canvas-ts-rx, 4deg")
    expect(main.transform).toContain("--canvas-ts-scale, 1.5")

    const slot = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      borderAnimated: false,
    })
    expect(slot.transform).toContain("--slot-ts-rx, 4deg")
    // Same style, different namespace — this is the whole point of sharing it.
    expect(slot.transform).not.toContain("--canvas-ts")
  })

  it("reads the corner radius through the animatable preview var", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ borderRadius: 30 }),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      borderAnimated: false,
    })
    expect(imgStyle.borderRadius).toBe("var(--editor-screenshot-radius, 30px)")
  })

  it("chains enhance + asset filter, leaving filter unset when both are empty", () => {
    const none = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      assetFilter: "none",
      transformVarPrefix: "slot-ts",
      borderAnimated: false,
    })
    expect(none.filterChain).toBe("")
    expect(none.imgStyle.filter).toBeUndefined()

    const bw = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      assetFilter: "bw",
      transformVarPrefix: "slot-ts",
      borderAnimated: false,
    })
    expect(bw.filterChain).toContain("grayscale(1)")
    expect(bw.imgStyle.filter).toBe(bw.filterChain)
  })

  it("mounts the border outline when the border is visible", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ border: redBorder }),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      borderAnimated: false,
    })
    expect(imgStyle.outline).toContain("--editor-border-outline-preview")
    expect(imgStyle.outline).toContain("#ff0000")
  })

  it("leaves the outline off for an invisible, non-animated border", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ border: noBorder }),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      borderAnimated: false,
    })
    expect(imgStyle.outline).toBeUndefined()
  })

  it("mounts a transparent outline when an invisible border is animated", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ border: noBorder }),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      borderAnimated: true,
    })
    expect(imgStyle.outline).toContain("0px solid transparent")
  })

  it("merges full-page capture media style onto the image box", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      borderAnimated: false,
      fullPageMediaStyle: { objectPosition: "top center" },
    })
    expect(imgStyle.objectPosition).toBe("top center")
  })
})
