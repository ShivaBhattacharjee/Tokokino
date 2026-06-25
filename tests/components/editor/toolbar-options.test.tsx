import { describe, expect, it } from "vitest"

import {
  ENHANCE_PRESETS,
  FIT_OPTIONS,
} from "@/components/editor/floating-toolbar-parts/options"

/**
 * `floating-toolbar-parts/options` — static option catalogues. Guard the
 * values/ids other components key off of.
 */
describe("FIT_OPTIONS", () => {
  it("exposes contain/cover/fill with labels and icons", () => {
    expect(FIT_OPTIONS.map((o) => o.value)).toEqual([
      "contain",
      "cover",
      "fill",
    ])
    for (const opt of FIT_OPTIONS) {
      expect(opt.label).toBeTruthy()
      expect(opt.icon).toBeTruthy()
    }
  })
})

describe("ENHANCE_PRESETS", () => {
  it("starts with the off preset and includes the known presets", () => {
    expect(ENHANCE_PRESETS[0].id).toBe("off")
    expect(ENHANCE_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        "off",
        "auto",
        "vivid",
        "soft",
        "dramatic",
        "sharp",
      ])
    )
  })

  it("gives every non-off preset a CSS filter", () => {
    for (const preset of ENHANCE_PRESETS) {
      if (preset.id === "off") continue
      expect(preset.filter).toBeTruthy()
    }
  })
})
