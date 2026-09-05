import { describe, expect, it } from "vitest"

import { shadowCss, shadowDropFilterCss } from "@/lib/editor/css-utils"
import { shadowBetween } from "@/lib/editor/animation-playback"
import { shadowExtentPx } from "@/lib/editor/animation-export/video-media/frame-canvas-utils"
import type { Shadow, ShadowType } from "@/lib/editor/state-types"

const splitLayers = (css: string): string[] =>
  css.split("), ").map((l) => (l.endsWith(")") ? l : `${l})`))

const alphaOf = (layer: string): number =>
  parseFloat(layer.match(/([\d.]+)\)$/)![1])

const shadow = (patch: Partial<Shadow> = {}): Shadow => ({
  type: "contact",
  intensity: 60,
  lightSource: "0-4",
  color: "#000000",
  ...patch,
})

describe("shadowCss for contact and stack", () => {
  it("casts contact away from the light source in two layers", () => {
    const css = shadowCss(shadow())!
    expect(css.split("), ").length).toBe(2)
    // Light at the top-right corner throws the cast down and to the left.
    expect(css.startsWith("-")).toBe(true)
    expect(css).toContain("rgba(0, 0, 0,")
  })

  it("steps stack through three offsets of fading opacity", () => {
    const layers = splitLayers(shadowCss(shadow({ type: "stack" }))!)
    expect(layers).toHaveLength(3)
    const alphas = layers.map(alphaOf)
    expect(alphas[0]).toBeGreaterThan(alphas[1])
    expect(alphas[1]).toBeGreaterThan(alphas[2])
  })

  it("collapses contact and stack to nothing as intensity approaches zero", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      for (const layer of splitLayers(
        shadowCss(shadow({ type, intensity: 1 }))!
      )) {
        expect(alphaOf(layer)).toBeLessThan(0.01)
        for (const length of layer.match(/-?[\d.]+px/g)!) {
          expect(Math.abs(parseFloat(length))).toBeLessThan(1)
        }
      }
    }
  })

  it("renders nothing at zero intensity", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      expect(shadowCss(shadow({ type, intensity: 0 }))).toBeUndefined()
    }
  })

  it("converts to drop-shadow filters for framed screenshots", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      const filter = shadowDropFilterCss(shadow({ type }))!
      expect(filter).toMatch(/^drop-shadow\(/)
      expect(filter).not.toContain("NaN")
    }
  })
})

describe("animating contact and stack", () => {
  it("renders the fractional light source shadowBetween produces", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      const from = shadow({ type, intensity: 0, lightSource: "0-4" })
      const to = shadow({ type, intensity: 80, lightSource: "4-0" })
      const mid = shadowBetween(from, to, 0.5)
      expect(mid.lightSource).toBe("2-2")
      const css = shadowCss(mid)!
      expect(css).not.toContain("NaN")
      // Mid-travel the light is dead centre, so the cast has no offset.
      expect(css.startsWith("0.0px 0.0px")).toBe(true)
    }
  })

  it("grows from nothing as a first shadow keyframe reveals", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      const rest = shadow({ type: "none", intensity: 40 })
      const to = shadow({ type, intensity: 100 })
      expect(shadowCss(shadowBetween(rest, to, 0))).toBeUndefined()
      expect(shadowCss(shadowBetween(rest, to, 1))).toBe(shadowCss(to))
    }
  })
})

describe("webkit export paths", () => {
  it("chains one drop-shadow per box-shadow layer, as the framed path needs", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      const s = shadow({ type, intensity: 100 })
      const layers = splitLayers(shadowCss(s)!).length
      const filter = shadowDropFilterCss(s)!
      expect(filter.match(/drop-shadow\(/g)).toHaveLength(layers)
      // Negative spread has no drop-shadow equivalent and must not leak through
      // as a fourth length, which WebKit would drop the whole filter over.
      for (const fn of filter.match(/drop-shadow\([^)]*\)[^)]*\)/g) ?? []) {
        expect(fn.match(/px/g)).toHaveLength(3)
      }
    }
  })

  it("reserves texture margin for every layer of the new shadows", () => {
    for (const type of ["contact", "stack"] as ShadowType[]) {
      const el = document.createElement("div")
      el.style.boxShadow = shadowCss(shadow({ type, intensity: 100 }))!
      const extent = shadowExtentPx(el)
      expect(extent).toBeGreaterThan(0)
      expect(Number.isFinite(extent)).toBe(true)
    }
  })
})

describe("chained drop-shadow extent", () => {
  it("reserves margin for the layer that reaches furthest, not the first", () => {
    // Chained drop-shadows are space-separated, so reading four lengths off the
    // whole chain mixed layer 1's offsets with layer 2's and under-reserved.
    const el = document.createElement("div")
    el.style.filter =
      "drop-shadow(-4px 4px 6px rgba(0, 0, 0, 0.7)) " +
      "drop-shadow(-10px 10px 29px rgba(0, 0, 0, 0.4))"
    expect(shadowExtentPx(el)).toBe(49)
  })

  it("still measures the widest box-shadow layer", () => {
    const el = document.createElement("div")
    el.style.boxShadow =
      "-18px 18px 2px 0px rgba(0, 0, 0, 0.62), -54px 54px 2px 0px rgba(0, 0, 0, 0.22)"
    expect(shadowExtentPx(el)).toBe(110)
  })
})

describe("negative spread in the drop-shadow conversion", () => {
  it("shrinks the blur by the inset instead of discarding it", () => {
    // Contact at 60%: near blur 7.2 inset 1.8, far blur 22.8 inset 5.4 — each
    // covers blur-minus-inset past the box edge, which is what the filter has
    // to reproduce. Discarding the inset exported both layers too wide.
    const filter = shadowDropFilterCss(shadow({ type: "contact" }))!
    const blurs = Array.from(
      filter.matchAll(/drop-shadow\(\S+ \S+ ([\d.]+)px/g),
      (m) => parseFloat(m[1])
    )
    expect(blurs).toEqual([5.4, 17.4])
  })

  it("keeps the historic 2x fold for positive spread", () => {
    // glow and soft rely on it — only the negative branch changed.
    const glow = shadow({ type: "glow", intensity: 100, lightSource: "center" })
    expect(shadowDropFilterCss(glow)!).toContain("136px")
  })
})
