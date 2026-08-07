import { describe, expect, it } from "vitest"

import {
  assetFilterCss,
  effectsFilterCss,
  enhanceFilterCss,
  isNeutralMediaAdjustments,
  mediaFilterCss,
  NEUTRAL_MEDIA_ADJUSTMENTS,
  scaleFilterBlur,
} from "@/lib/editor/css-utils"
import type { AssetFilter, BackdropEffects } from "@/lib/editor/state-types"

const NEUTRAL_EFFECTS: BackdropEffects = {
  noise: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  opacity: 100,
}

describe("assetFilterCss", () => {
  it("returns undefined for the passthrough filter", () => {
    expect(assetFilterCss("none")).toBeUndefined()
  })

  it("maps each named filter to a concrete CSS filter string", () => {
    expect(assetFilterCss("bw")).toBe("grayscale(1) contrast(1.05)")
    expect(assetFilterCss("vivid")).toBe("saturate(1.5) contrast(1.15)")
    expect(assetFilterCss("noir")).toBe(
      "grayscale(1) contrast(1.35) brightness(0.9)"
    )
    expect(assetFilterCss("invert")).toBe("invert(1) hue-rotate(180deg)")
  })

  it("produces a defined, non-empty string for every non-none filter", () => {
    const filters: AssetFilter[] = [
      "bw",
      "sepia",
      "vintage",
      "warm",
      "cool",
      "fade",
      "vivid",
      "noir",
      "dream",
      "mono",
      "invert",
    ]
    for (const f of filters) {
      const css = assetFilterCss(f)
      expect(css, `filter ${f}`).toBeTruthy()
      expect(typeof css).toBe("string")
    }
  })
})

describe("enhanceFilterCss", () => {
  it("returns undefined when enhancement is off", () => {
    expect(enhanceFilterCss("off")).toBeUndefined()
  })

  it("maps each enhance preset to a filter string", () => {
    expect(enhanceFilterCss("auto")).toBe(
      "brightness(1.04) contrast(1.08) saturate(1.1)"
    )
    expect(enhanceFilterCss("vivid")).toBe(
      "brightness(1.05) contrast(1.12) saturate(1.35)"
    )
    expect(enhanceFilterCss("dramatic")).toBe(
      "brightness(0.98) contrast(1.25) saturate(1.2)"
    )
  })
})

describe("effectsFilterCss", () => {
  it("returns undefined for fully neutral effects", () => {
    expect(effectsFilterCss(NEUTRAL_EFFECTS)).toBeUndefined()
  })

  it("emits only the channels that deviate from neutral", () => {
    expect(effectsFilterCss({ ...NEUTRAL_EFFECTS, blur: 4 })).toBe("blur(4px)")
    expect(effectsFilterCss({ ...NEUTRAL_EFFECTS, brightness: 120 })).toBe(
      "brightness(120%)"
    )
    expect(effectsFilterCss({ ...NEUTRAL_EFFECTS, hue: -30 })).toBe(
      "hue-rotate(-30deg)"
    )
  })

  it("composes multiple active channels in canonical order", () => {
    const css = effectsFilterCss({
      ...NEUTRAL_EFFECTS,
      blur: 2,
      contrast: 130,
      saturation: 80,
      grayscale: 50,
      opacity: 90,
    })
    expect(css).toBe(
      "blur(2px) contrast(130%) saturate(80%) grayscale(50%) opacity(90%)"
    )
  })

  it("ignores the noise channel (not a CSS filter)", () => {
    const noisy: BackdropEffects = { ...NEUTRAL_EFFECTS, noise: 80 }
    expect(effectsFilterCss(noisy)).toBeUndefined()
  })

  it("treats blur of exactly 0 as no blur", () => {
    expect(effectsFilterCss({ ...NEUTRAL_EFFECTS, blur: 0 })).toBeUndefined()
  })
})

describe("mediaFilterCss", () => {
  it("is empty when nothing grades the media", () => {
    expect(
      mediaFilterCss({
        enhance: "off",
        filter: "none",
        adjustments: NEUTRAL_MEDIA_ADJUSTMENTS,
      })
    ).toBe("")
  })

  it("chains enhance, then the filter preset, then the manual grade", () => {
    expect(
      mediaFilterCss({
        enhance: "sharp",
        filter: "sepia",
        adjustments: { ...NEUTRAL_MEDIA_ADJUSTMENTS, hue: 20 },
      })
    ).toBe(
      "brightness(1.02) contrast(1.18) saturate(1.05) sepia(0.85) saturate(1.1) hue-rotate(20deg)"
    )
  })

  it("skips the legs it was given nothing for", () => {
    expect(mediaFilterCss({ filter: "bw" })).toBe("grayscale(1) contrast(1.05)")
  })
})

describe("isNeutralMediaAdjustments", () => {
  it("is true only when every channel sits at its neutral value", () => {
    expect(isNeutralMediaAdjustments(NEUTRAL_MEDIA_ADJUSTMENTS)).toBe(true)
    expect(
      isNeutralMediaAdjustments({ ...NEUTRAL_MEDIA_ADJUSTMENTS, blur: 1 })
    ).toBe(false)
    expect(
      isNeutralMediaAdjustments({ ...NEUTRAL_MEDIA_ADJUSTMENTS, hue: -10 })
    ).toBe(false)
  })
})

describe("scaleFilterBlur", () => {
  const graded = (blur: number) =>
    mediaFilterCss({
      enhance: "vivid",
      filter: "dream",
      adjustments: { ...NEUTRAL_MEDIA_ADJUSTMENTS, blur, brightness: 120 },
    })

  it("leaves the chain untouched at 1x", () => {
    expect(scaleFilterBlur(graded(8), 1)).toBe(graded(8))
  })

  it("scales every blur leg at 2x and nothing else", () => {
    const scaled = scaleFilterBlur(graded(8), 2)
    // The manual grade's blur AND the `dream` preset's own 0.5px blur.
    expect(scaled).toContain("blur(16px)")
    expect(scaled).toContain("blur(1px)")
    expect(scaled).not.toContain("blur(8px)")
    expect(scaled).not.toContain("blur(0.5px)")
    // Non-length legs are scale-invariant and must survive verbatim.
    expect(scaled).toContain("brightness(120%)")
    expect(scaled).toContain("saturate(1.35)")
    expect(scaled).toContain("contrast(1.12)")
  })

  it("is a no-op on a chain with no blur", () => {
    const chain = mediaFilterCss({ enhance: "vivid" })
    expect(scaleFilterBlur(chain, 4)).toBe(chain)
    expect(scaleFilterBlur("", 4)).toBe("")
  })
})
