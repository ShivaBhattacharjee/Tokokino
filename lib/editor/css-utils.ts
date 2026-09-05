import type * as React from "react"

import { hexToRgb } from "./color-utils"
import type {
  AssetFilter,
  Background,
  Border,
  EnhancePreset,
  MediaAdjustments,
  Shadow,
} from "./state-types"

export function assetFilterCss(filter: AssetFilter): string | undefined {
  switch (filter) {
    case "bw":
      return "grayscale(1) contrast(1.05)"
    case "sepia":
      return "sepia(0.85) saturate(1.1)"
    case "vintage":
      return "sepia(0.4) contrast(0.95) saturate(0.9) hue-rotate(-10deg)"
    case "warm":
      return "saturate(1.15) hue-rotate(-12deg) brightness(1.04)"
    case "cool":
      return "saturate(1.1) hue-rotate(15deg) brightness(1.02)"
    case "fade":
      return "contrast(0.85) brightness(1.08) saturate(0.85)"
    case "vivid":
      return "saturate(1.5) contrast(1.15)"
    case "noir":
      return "grayscale(1) contrast(1.35) brightness(0.9)"
    case "dream":
      return "blur(0.5px) saturate(1.2) brightness(1.05) contrast(0.95)"
    case "mono":
      return "grayscale(1) sepia(0.3) contrast(1.05)"
    case "invert":
      return "invert(1) hue-rotate(180deg)"
    case "none":
    default:
      return undefined
  }
}

/**
 * A filter preset expressed as numbers so two presets can be blended.
 * `assetFilterCss` hands back a ready-made string, and there is no way to ease
 * one string into another — Animate mode needs the channels.
 *
 * Multiplier channels are 1 at neutral, amount channels 0, `hueRotate` in
 * degrees and `blur` in px.
 */
export type FilterVector = {
  blur: number
  grayscale: number
  sepia: number
  saturate: number
  hueRotate: number
  brightness: number
  contrast: number
  invert: number
}

export const NEUTRAL_FILTER_VECTOR: FilterVector = {
  blur: 0,
  grayscale: 0,
  sepia: 0,
  saturate: 1,
  hueRotate: 0,
  brightness: 1,
  contrast: 1,
  invert: 0,
}

const filterVector = (v: Partial<FilterVector>): FilterVector => ({
  ...NEUTRAL_FILTER_VECTOR,
  ...v,
})

/** The channel values behind each preset in `assetFilterCss`. */
export function assetFilterVector(filter: AssetFilter): FilterVector {
  switch (filter) {
    case "bw":
      return filterVector({ grayscale: 1, contrast: 1.05 })
    case "sepia":
      return filterVector({ sepia: 0.85, saturate: 1.1 })
    case "vintage":
      return filterVector({
        sepia: 0.4,
        contrast: 0.95,
        saturate: 0.9,
        hueRotate: -10,
      })
    case "warm":
      return filterVector({ saturate: 1.15, hueRotate: -12, brightness: 1.04 })
    case "cool":
      return filterVector({ saturate: 1.1, hueRotate: 15, brightness: 1.02 })
    case "fade":
      return filterVector({ contrast: 0.85, brightness: 1.08, saturate: 0.85 })
    case "vivid":
      return filterVector({ saturate: 1.5, contrast: 1.15 })
    case "noir":
      return filterVector({ grayscale: 1, contrast: 1.35, brightness: 0.9 })
    case "dream":
      return filterVector({
        blur: 0.5,
        saturate: 1.2,
        brightness: 1.05,
        contrast: 0.95,
      })
    case "mono":
      return filterVector({ grayscale: 1, sepia: 0.3, contrast: 1.05 })
    case "invert":
      return filterVector({ invert: 1, hueRotate: 180 })
    case "none":
    default:
      return NEUTRAL_FILTER_VECTOR
  }
}

export function filterVectorBetween(
  from: FilterVector,
  to: FilterVector,
  p: number
): FilterVector {
  const mix = (a: number, b: number) => a + (b - a) * p
  return {
    blur: mix(from.blur, to.blur),
    grayscale: mix(from.grayscale, to.grayscale),
    sepia: mix(from.sepia, to.sepia),
    saturate: mix(from.saturate, to.saturate),
    hueRotate: mix(from.hueRotate, to.hueRotate),
    brightness: mix(from.brightness, to.brightness),
    contrast: mix(from.contrast, to.contrast),
    invert: mix(from.invert, to.invert),
  }
}

const round3 = (n: number) => Number(n.toFixed(3))

/**
 * A blended preset as a filter chain.
 *
 * The leg order is not the one `assetFilterCss` writes per preset, because a
 * single fixed order has to serve every blend. `grayscale` stays ahead of
 * `sepia` (the reverse would flatten "mono"'s tint to plain grey); the rest are
 * a linear matrix, a scalar, and an affine, which commute closely enough that
 * the two chains agree to well under a 1/255 step. Only used mid-blend anyway —
 * a sample sitting on one preset emits that preset's own chain verbatim.
 */
export function filterVectorCss(v: FilterVector): string | undefined {
  const parts: string[] = []
  if (v.blur > 0) parts.push(`blur(${round3(v.blur)}px)`)
  if (v.grayscale > 0) parts.push(`grayscale(${round3(v.grayscale)})`)
  if (v.sepia > 0) parts.push(`sepia(${round3(v.sepia)})`)
  if (v.saturate !== 1) parts.push(`saturate(${round3(v.saturate)})`)
  if (v.hueRotate !== 0) parts.push(`hue-rotate(${round3(v.hueRotate)}deg)`)
  if (v.brightness !== 1) parts.push(`brightness(${round3(v.brightness)})`)
  if (v.contrast !== 1) parts.push(`contrast(${round3(v.contrast)})`)
  if (v.invert > 0) parts.push(`invert(${round3(v.invert)})`)
  return parts.length ? parts.join(" ") : undefined
}

export function patternCssFor(
  id: number,
  color: string,
  thickness: number
): React.CSSProperties {
  const t = Math.max(0.5, thickness)
  switch (id) {
    case 1:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "10px 10px",
      }
    case 2:
      return {
        backgroundImage: `linear-gradient(${color} ${t}px, transparent ${t}px), linear-gradient(90deg, ${color} ${t}px, transparent ${t}px)`,
        backgroundSize: "14px 14px",
      }
    case 3:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 8px)`,
      }
    case 4:
      return {
        backgroundImage: `radial-gradient(${color} ${t}px, transparent ${t}px), radial-gradient(${color} ${Math.max(
          0.5,
          t - 0.3
        )}px, transparent ${Math.max(0.5, t - 0.3)}px)`,
        backgroundSize: "9px 9px, 13px 13px",
        backgroundPosition: "0 0, 4px 4px",
      }
    case 5:
      return {
        backgroundImage: `conic-gradient(from 180deg at 50% 50%, ${color}, transparent, ${color})`,
      }
    case 6:
      return {
        backgroundImage: `linear-gradient(30deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%), linear-gradient(150deg, ${color} 12%, transparent 12.5%, transparent 87%, ${color} 87.5%)`,
        backgroundSize: "60px 100px",
      }
    case 7:
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 ${t}px, transparent ${t}px 10px), repeating-linear-gradient(-45deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 8:
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 9:
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${t}px, transparent ${t}px 10px)`,
      }
    case 10: {
      const r = Math.max(3, 5 - t / 2)
      return {
        backgroundImage: `radial-gradient(circle, transparent ${r}px, ${color} ${r}px ${r + t}px, transparent ${r + t}px)`,
        backgroundSize: "20px 20px",
      }
    }
    case 11:
      return {
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%)`,
        backgroundSize: "16px 16px",
        backgroundPosition: "-8px 0, -8px 0, 0 0, 0 0",
      }
    case 12:
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 ${t * 3}px, transparent ${t * 3}px ${t * 6}px)`,
      }
    case 13: {
      const gap = Math.max(6, 10 - t)
      return {
        backgroundImage: `repeating-radial-gradient(circle at 50% 50%, ${color} 0 ${t}px, transparent ${t}px ${gap}px)`,
      }
    }
    case 14:
      return {
        backgroundImage: `repeating-conic-gradient(from 0deg at 50% 50%, ${color} 0deg ${Math.max(1, t)}deg, transparent ${Math.max(1, t)}deg 15deg)`,
      }
    default:
      return {}
  }
}

export function enhanceFilterCss(preset: EnhancePreset): string | undefined {
  switch (preset) {
    case "auto":
      return "brightness(1.04) contrast(1.08) saturate(1.1)"
    case "vivid":
      return "brightness(1.05) contrast(1.12) saturate(1.35)"
    case "soft":
      return "brightness(1.06) contrast(0.96) saturate(0.9)"
    case "dramatic":
      return "brightness(0.98) contrast(1.25) saturate(1.2)"
    case "sharp":
      return "brightness(1.02) contrast(1.18) saturate(1.05)"
    case "off":
    default:
      return undefined
  }
}

export const NEUTRAL_MEDIA_ADJUSTMENTS: MediaAdjustments = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
}

export function isNeutralMediaAdjustments(a: MediaAdjustments): boolean {
  return (
    a.blur === 0 &&
    a.brightness === 100 &&
    a.contrast === 100 &&
    a.saturation === 100 &&
    a.hue === 0 &&
    a.grayscale === 0 &&
    a.sepia === 0 &&
    a.invert === 0
  )
}

export function effectsFilterCss(
  e: MediaAdjustments & { opacity?: number }
): string | undefined {
  const parts: string[] = []
  if (e.blur > 0) parts.push(`blur(${e.blur}px)`)
  if (e.brightness !== 100) parts.push(`brightness(${e.brightness}%)`)
  if (e.contrast !== 100) parts.push(`contrast(${e.contrast}%)`)
  if (e.saturation !== 100) parts.push(`saturate(${e.saturation}%)`)
  if (e.hue !== 0) parts.push(`hue-rotate(${e.hue}deg)`)
  if (e.grayscale > 0) parts.push(`grayscale(${e.grayscale}%)`)
  if (e.sepia > 0) parts.push(`sepia(${e.sepia}%)`)
  if (e.invert > 0) parts.push(`invert(${e.invert}%)`)
  if (e.opacity !== undefined && e.opacity !== 100) {
    parts.push(`opacity(${e.opacity}%)`)
  }
  return parts.length ? parts.join(" ") : undefined
}

/**
 * Rewrite the blur legs of a filter chain into a different pixel scale.
 *
 * `blur()` is the only length in the chain, so it is the only leg that does not
 * survive a change of raster scale. CSS blur is in CSS pixels and scales with
 * the raster for free; a hand-painted canvas at 2×/4× export scale does not, so
 * an unscaled `blur(8px)` lands a quarter as strong in a 4K export as on canvas.
 */
export function scaleFilterBlur(filter: string, scale: number): string {
  if (!filter || scale === 1) return filter
  return filter.replace(
    /blur\(([\d.]+)px\)/g,
    (_, px: string) => `blur(${Number(px) * scale}px)`
  )
}

/**
 * The full filter chain a screenshot/video renders with: the canvas enhance
 * preset, then the media filter preset, then the manual colour grade. Both the
 * DOM renderers and the export frame renderers (which draw decoded video pixels
 * themselves and must re-apply what CSS would have done) build it here.
 */
export function mediaFilterCss({
  enhance,
  filter,
  filterCss,
  adjustments,
}: {
  enhance?: EnhancePreset | null
  filter?: AssetFilter | null
  /**
   * Ready-made filter-preset legs, used instead of resolving `filter`. Animate
   * mode blends between two presets, and the result is a channel mix that no
   * single `AssetFilter` names.
   */
  filterCss?: string | null
  adjustments?: MediaAdjustments | null
}): string {
  return [
    enhance ? enhanceFilterCss(enhance) : undefined,
    filterCss !== undefined && filterCss !== null
      ? filterCss || undefined
      : filter
        ? assetFilterCss(filter)
        : undefined,
    adjustments ? effectsFilterCss(adjustments) : undefined,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
}

function shadowRgba(color: string, opacity: number): string {
  const { r, g, b } = hexToRgb(color || "#000000")
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)})`
}

/** Light direction as a unit offset; "center" and the middle cell are both 0,0. */
export function shadowLightOffset(lightSource: string): {
  dx: number
  dy: number
} {
  if (lightSource === "center") return { dx: 0, dy: 0 }
  const [r, c] = lightSource.split("-").map(Number)
  if (!Number.isFinite(r) || !Number.isFinite(c)) return { dx: 0, dy: 0 }
  return { dx: -(c - 2), dy: -(r - 2) }
}

export function shadowCss(shadow: Shadow): string | undefined {
  if (shadow.type === "none" || shadow.intensity <= 0) return undefined
  const intensity = shadow.intensity / 100
  const color = shadow.color || "#000000"

  if (shadow.type === "glow") {
    const blur = 30 + intensity * 90
    const spread = intensity * 8
    const opacity = 0.18 + intensity * 0.42
    return `0 0 ${blur}px ${spread}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "soft") {
    const { dx, dy } = shadowLightOffset(shadow.lightSource)
    const unit = intensity * 10
    const blur = 40 + intensity * 80
    const spread = intensity * 4
    const opacity = 0.1 + intensity * 0.2
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread.toFixed(1)}px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "hard") {
    const { dx, dy } = shadowLightOffset(shadow.lightSource)
    const unit = intensity * 12
    const opacity = 0.25 + intensity * 0.45
    return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px 0px 0px ${shadowRgba(color, opacity)}`
  }

  if (shadow.type === "float") {
    const opacity1 = 0.12 + intensity * 0.18
    const opacity2 = 0.08 + intensity * 0.12
    const blur1 = 15 + intensity * 25
    const blur2 = 40 + intensity * 60
    const dy1 = 4 + intensity * 12
    const dy2 = 8 + intensity * 20
    return `0 ${dy1.toFixed(1)}px ${blur1.toFixed(1)}px 0px ${shadowRgba(color, opacity1)}, 0 ${dy2.toFixed(1)}px ${blur2.toFixed(1)}px 0px ${shadowRgba(color, opacity2)}`
  }

  // Contact and Stack size EVERY dimension off intensity — offset, blur and
  // alpha all reach 0 together — so an animated reveal grows out of nothing
  // instead of popping in at a visible offset, and the release mirrors it.
  if (shadow.type === "contact") {
    const { dx, dy } = shadowLightOffset(shadow.lightSource)
    const unit = intensity * 5
    const near = `${(dx * unit * 0.4).toFixed(1)}px ${(dy * unit * 0.4).toFixed(1)}px ${(intensity * 12).toFixed(1)}px ${(intensity * -3).toFixed(1)}px ${shadowRgba(color, intensity * 0.7)}`
    const far = `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${(intensity * 38).toFixed(1)}px ${(intensity * -9).toFixed(1)}px ${shadowRgba(color, intensity * 0.4)}`
    return `${near}, ${far}`
  }

  if (shadow.type === "stack") {
    const { dx, dy } = shadowLightOffset(shadow.lightSource)
    const step = intensity * 9
    // A zero-blur edge snaps to whole pixels, so a stack sliding out one
    // fractional step per frame visibly stutters — 2px of blur is invisible at
    // rest and enough to keep the travel continuous.
    const blur = intensity * 2
    return [0.62, 0.4, 0.22]
      .map((alpha, i) => {
        const distance = step * (i + 1)
        return `${(dx * distance).toFixed(1)}px ${(dy * distance).toFixed(1)}px ${blur.toFixed(1)}px 0px ${shadowRgba(color, intensity * alpha)}`
      })
      .join(", ")
  }

  if (shadow.type === "linear") {
    const { dx, dy } = shadowLightOffset(shadow.lightSource)
    const unit = intensity * 12
    const opacity1 = 0.1 + intensity * 0.15
    const opacity2 = 0.08 + intensity * 0.12
    const opacity3 = 0.05 + intensity * 0.08
    const opacity4 = 0.02 + intensity * 0.05
    return `${(dx * unit * 0.5).toFixed(1)}px ${(dy * unit * 0.5).toFixed(1)}px ${(10 + intensity * 15).toFixed(1)}px 0px ${shadowRgba(color, opacity1)}, ${(dx * unit * 1.2).toFixed(1)}px ${(dy * unit * 1.2).toFixed(1)}px ${(25 + intensity * 35).toFixed(1)}px 0px ${shadowRgba(color, opacity2)}, ${(dx * unit * 2.2).toFixed(1)}px ${(dy * unit * 2.2).toFixed(1)}px ${(45 + intensity * 65).toFixed(1)}px 0px ${shadowRgba(color, opacity3)}, ${(dx * unit * 3.5).toFixed(1)}px ${(dy * unit * 3.5).toFixed(1)}px ${(70 + intensity * 100).toFixed(1)}px 0px ${shadowRgba(color, opacity4)}`
  }

  const { dx, dy } = shadowLightOffset(shadow.lightSource)
  const unit = intensity * 16
  const blur = 20 + intensity * 60
  const spread = -2
  const opacity = 0.15 + intensity * 0.35
  return `${(dx * unit).toFixed(1)}px ${(dy * unit).toFixed(1)}px ${blur.toFixed(1)}px ${spread}px ${shadowRgba(color, opacity)}`
}

export const SHADOW_PREVIEW_VAR = "--editor-shadow-preview"
export const SHADOW_FILTER_PREVIEW_VAR = "--editor-shadow-filter-preview"

/** Box-shadow that supports live direction preview without clobbering React styles. */
export function shadowBoxShadowCss(
  committed: string | undefined
): string | undefined {
  if (!committed) return undefined
  return `var(${SHADOW_PREVIEW_VAR}, ${committed})`
}

/** Drop-shadow filter that supports live preview without a store re-render. */
export function shadowDropFilterPreviewCss(
  committed: string | undefined
): string | undefined {
  if (!committed) return undefined
  return `var(${SHADOW_FILTER_PREVIEW_VAR}, ${committed})`
}

export const BORDER_OUTLINE_PREVIEW_VAR = "--editor-border-outline-preview"
export const BORDER_OFFSET_PREVIEW_VAR = "--editor-border-offset-preview"
/** Screenshot corner-radius live preview (Border section "Radius" slider). */
export const SCREENSHOT_RADIUS_PREVIEW_VAR = "--editor-screenshot-radius"

/**
 * Media colour-grade live preview. One var per screenshot box rather than one
 * canvas-wide var: the grade sliders honour the current selection (a slot, the
 * main screenshot, or all of them), so a canvas-wide var would preview an edit
 * on boxes the commit will not touch.
 */
export const MAIN_MEDIA_FX_PREVIEW_VAR = "--editor-media-fx-main"

export function slotMediaFxPreviewVar(slotId: string): string {
  return `--editor-media-fx-${slotId}`
}

/** The `outline` shorthand a border renders as (invisible when width is 0). */
export function borderOutlineCss(border: Border): string {
  return `${Math.max(0, border.width)}px ${border.style || "solid"} ${
    border.color || "#ffffff"
  }`
}

/** The `outline-offset` a border renders as. */
export function borderOffsetCss(border: Border): string {
  return `${border.padding || 0}px`
}

/**
 * Convert the box-shadow string produced by `shadowCss` into a chain of
 * `drop-shadow(...)` filter functions. Use this when the shadow should follow
 * the alpha silhouette of the rendered content (e.g. a device-frame PNG with
 * rounded corners and a notch) rather than the rectangular bounding box.
 *
 * Notes:
 * - `drop-shadow()` does not accept a spread radius. We approximate spread by
 *   folding it into the blur radius, which visually matches well for the
 *   moderate spreads used by our shadow presets.
 * - Multiple comma-separated shadows (e.g. the "float" preset) become multiple
 *   chained `drop-shadow()` calls.
 */
export function shadowDropFilterCss(shadow: Shadow): string | undefined {
  const css = shadowCss(shadow)
  if (!css) return undefined
  return boxShadowToDropFilterCss(css)
}

/**
 * A `box-shadow` value as the equivalent chain of `drop-shadow()` filters.
 *
 * Takes the CSS rather than a `Shadow` so it can convert a value already
 * resolved by the engine — the export clone reads `getComputedStyle` and has no
 * `Shadow` object to hand.
 */
export function boxShadowToDropFilterCss(
  boxShadow: string
): string | undefined {
  if (!boxShadow || boxShadow === "none") return undefined
  const parts = splitTopLevelCommas(boxShadow)
    .map(boxShadowSegmentToDropShadow)
    .filter((v): v is string => Boolean(v))
  return parts.length ? parts.join(" ") : undefined
}

function splitTopLevelCommas(value: string): string[] {
  const out: string[] = []
  let current = ""
  let depth = 0
  for (const ch of value) {
    if (ch === "(") depth += 1
    else if (ch === ")") depth -= 1
    if (ch === "," && depth === 0) {
      out.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  if (current.trim()) out.push(current.trim())
  return out
}

function boxShadowSegmentToDropShadow(segment: string): string | null {
  // Split on whitespace, but keep parenthesized color values together.
  const tokens: string[] = []
  let buf = ""
  let depth = 0
  for (const ch of segment) {
    if (ch === "(") depth += 1
    else if (ch === ")") depth -= 1
    if (/\s/.test(ch) && depth === 0) {
      if (buf) {
        tokens.push(buf)
        buf = ""
      }
      continue
    }
    buf += ch
  }
  if (buf) tokens.push(buf)

  // Filter out "inset" — drop-shadow doesn't support it.
  const filtered = tokens.filter((t) => t.toLowerCase() !== "inset")
  // Authored box-shadows put the colour last, but a COMPUTED one puts it first,
  // and the export clone converts computed values — so sort by what each token
  // is rather than by where it sits. Nothing but a length can look like one:
  // every colour form is either a keyword, a hash, or a parenthesised function
  // the tokenizer above keeps whole.
  const lengthRe = /^-?\d+(\.\d+)?(px|em|rem|%)?$/
  const lengths: string[] = []
  const colorParts: string[] = []
  for (const tok of filtered) {
    if (lengthRe.test(tok)) lengths.push(tok)
    else colorParts.push(tok)
  }
  const color = colorParts.join(" ")
  if (lengths.length < 2) return null
  const [dx, dy, blurRaw, spreadRaw] = lengths
  const blur = parseFloat(blurRaw ?? "0")
  const spread = parseFloat(spreadRaw ?? "0")
  // Fold spread into blur as an approximation (drop-shadow has no spread).
  // A NEGATIVE spread insets the shadow rect, so it has to shrink the blur —
  // discarding it made the tight casts (drop, contact) export softer and wider
  // than they render on canvas. It folds at 1x, which matches the extent the
  // box-shadow actually covers; positive spread keeps its historic 2x.
  const effectiveBlur = Math.max(0, blur + (spread > 0 ? spread * 2 : spread))
  // Rounded because the fold is float arithmetic on already-rounded lengths,
  // and 5.3999999999999995px in a filter chain helps nobody.
  return `drop-shadow(${dx} ${dy} ${Number(effectiveBlur.toFixed(2))}px ${color})`
}

export function backgroundCss(bg: Background): React.CSSProperties {
  if (bg.type === "none") return {}
  if (bg.type === "image") {
    return {
      backgroundImage: `url("${bg.value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
  }
  return { background: bg.value }
}
