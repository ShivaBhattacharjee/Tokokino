import type * as React from "react"

import type { ResolvedScreenshotStyle } from "./store/canvas-helpers"
import type { AssetFilter, EnhancePreset } from "./state-types"
import {
  assetFilterCss,
  BORDER_OFFSET_PREVIEW_VAR,
  BORDER_OUTLINE_PREVIEW_VAR,
  borderOffsetCss,
  borderOutlineCss,
  enhanceFilterCss,
  SCREENSHOT_RADIUS_PREVIEW_VAR,
  shadowBoxShadowCss,
  shadowCss,
  shadowDropFilterCss,
} from "./css-utils"

/**
 * The image-box CSS a screenshot renders with (transform, box-shadow, filter
 * chain, animatable radius, border outline). The main screenshot and every slot
 * share this so a slot can never drift from the optimized main behaviour — the
 * only differences are parameterised: which CSS-var namespace drives the live
 * tilt/scale, and whether a per-item asset filter is chained on.
 */
export type ScreenshotImageStyleParams = {
  style: ResolvedScreenshotStyle
  enhance: EnhancePreset
  /** Per-item colour filter (slots only). Main has none. */
  assetFilter?: AssetFilter | null
  /** CSS-var namespace AnimationLayer / drags write the live transform into. */
  transformVarPrefix: "canvas-ts" | "slot-ts"
  /**
   * True when an open Animate keyframe animates this screenshot's border, so the
   * outline must mount even when the committed border is invisible (the player
   * eases it in from 0 via the preview var).
   */
  borderAnimated: boolean
  /** Full-page-capture media style merged onto the image box, if any. */
  fullPageMediaStyle?: React.CSSProperties | null
}

export type ScreenshotImageStyle = {
  /** 3D transform string, reading live tilt/scale from the var namespace. */
  transform: string
  /** Style for the bare image box (radius, transform, shadow, filter, border). */
  imgStyle: React.CSSProperties
  /** drop-shadow() filter for framed screenshots (mockups draw shadow as filter). */
  shadowFilter: string | undefined
  /** Combined enhance + asset filter, for the <img> imageFilter prop. */
  filterChain: string
}

export function buildScreenshotImageStyle({
  style,
  enhance,
  assetFilter,
  transformVarPrefix,
  borderAnimated,
  fullPageMediaStyle,
}: ScreenshotImageStyleParams): ScreenshotImageStyle {
  const { tilt, scale, shadow, border, borderRadius } = style

  const transform = [
    "perspective(1400px)",
    `rotateX(var(--${transformVarPrefix}-rx, ${tilt.rx}deg))`,
    `rotateY(var(--${transformVarPrefix}-ry, ${tilt.ry}deg))`,
    `rotateZ(var(--${transformVarPrefix}-rz, ${tilt.rz}deg))`,
    `scale(var(--${transformVarPrefix}-scale, ${scale / 100}))`,
  ].join(" ")

  const filterChain = [
    enhanceFilterCss(enhance),
    assetFilterCss(assetFilter ?? "none"),
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  const imgStyle: React.CSSProperties = {
    // Read the radius via a var so an Animate-mode clip can ease it; falls back
    // to the committed value at rest / outside Animate mode.
    borderRadius: `var(${SCREENSHOT_RADIUS_PREVIEW_VAR}, ${borderRadius}px)`,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: shadowBoxShadowCss(shadowCss(shadow)),
    filter: filterChain || undefined,
  }

  if (fullPageMediaStyle) Object.assign(imgStyle, fullPageMediaStyle)

  // When a clip animates the border the outline is ALWAYS mounted (even when the
  // committed border is invisible) so the player can ease it in from 0 / recolour
  // it via the preview vars. Otherwise it renders only when committed.
  const borderVisible = Boolean(border.color) && border.width > 0
  if (borderAnimated || borderVisible) {
    const committedOutline = borderVisible
      ? borderOutlineCss(border)
      : "0px solid transparent"
    imgStyle.outline = `var(${BORDER_OUTLINE_PREVIEW_VAR}, ${committedOutline})`
    imgStyle.outlineOffset = `var(${BORDER_OFFSET_PREVIEW_VAR}, ${borderOffsetCss(border)})`
  }

  return {
    transform,
    imgStyle,
    shadowFilter: shadowDropFilterCss(shadow),
    filterChain,
  }
}
