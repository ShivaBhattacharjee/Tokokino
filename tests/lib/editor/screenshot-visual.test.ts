import { describe, expect, it } from "vitest"

import { buildScreenshotImageStyle } from "@/lib/editor/screenshot-visual"
import type { ResolvedScreenshotStyle } from "@/lib/editor/store/canvas-helpers"
import { NEUTRAL_MEDIA_ADJUSTMENTS } from "@/lib/editor/css-utils"
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
    filter: "none",
    adjustments: NEUTRAL_MEDIA_ADJUSTMENTS,
    ...overrides,
  }) satisfies ResolvedScreenshotStyle

describe("buildScreenshotImageStyle", () => {
  it("drives the live transform through the given var namespace", () => {
    const main = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      mediaFxVar: "--editor-media-fx-main",
      borderAnimated: false,
    })
    expect(main.transform).toContain("--canvas-ts-rx, 4deg")
    expect(main.transform).toContain("--canvas-ts-scale, 1.5")

    const slot = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      mediaFxVar: "--editor-media-fx-slot-1",
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
      mediaFxVar: "--editor-media-fx-main",
      borderAnimated: false,
    })
    expect(imgStyle.borderRadius).toBe("var(--editor-screenshot-radius, 30px)")
  })

  it("reads the grade through the box's own preview var, with an empty fallback when neutral", () => {
    const none = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      mediaFxVar: "--editor-media-fx-slot-1",
      borderAnimated: false,
    })
    // Empty, not `none` — the chain is also concatenated after a drop-shadow()
    // list, where `none` would invalidate the whole declaration.
    expect(none.filterChain).toBe("var(--editor-media-fx-slot-1,)")
    expect(none.imgStyle.filter).toBe(none.filterChain)
  })

  it("chains enhance, the filter preset and the manual grade in that order", () => {
    const graded = buildScreenshotImageStyle({
      style: baseStyle({
        filter: "bw",
        adjustments: { ...NEUTRAL_MEDIA_ADJUSTMENTS, brightness: 120 },
      }),
      enhance: "vivid",
      transformVarPrefix: "slot-ts",
      mediaFxVar: "--editor-media-fx-slot-1",
      borderAnimated: false,
    })
    expect(graded.filterChain).toBe(
      "var(--editor-media-fx-slot-1, brightness(1.05) contrast(1.12) saturate(1.35) grayscale(1) contrast(1.05) brightness(120%))"
    )
    expect(graded.imgStyle.filter).toBe(graded.filterChain)
  })

  it("mounts the border outline when the border is visible", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ border: redBorder }),
      enhance: "off",
      transformVarPrefix: "canvas-ts",
      mediaFxVar: "--editor-media-fx-main",
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
      mediaFxVar: "--editor-media-fx-main",
      borderAnimated: false,
    })
    expect(imgStyle.outline).toBeUndefined()
  })

  it("mounts a transparent outline when an invisible border is animated", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle({ border: noBorder }),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      mediaFxVar: "--editor-media-fx-slot-1",
      borderAnimated: true,
    })
    expect(imgStyle.outline).toContain("0px solid transparent")
  })

  it("merges full-page capture media style onto the image box", () => {
    const { imgStyle } = buildScreenshotImageStyle({
      style: baseStyle(),
      enhance: "off",
      transformVarPrefix: "slot-ts",
      mediaFxVar: "--editor-media-fx-slot-1",
      borderAnimated: false,
      fullPageMediaStyle: { objectPosition: "top center" },
    })
    expect(imgStyle.objectPosition).toBe("top center")
  })
})
