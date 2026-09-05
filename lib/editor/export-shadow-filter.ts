import { supportsObjectViewBox } from "./crop-utils"
import {
  boxShadowToDropFilterCss,
  SHADOW_FILTER_PREVIEW_VAR,
} from "./css-utils"

/**
 * Re-express a frameless screenshot's `box-shadow` as a `drop-shadow()` chain
 * in the export clone, on the engines that need it.
 *
 * WebKit rasterizes a `<foreignObject>` without painting the box-shadow on the
 * screenshot, so a frameless canvas exported from Safari came out with no
 * shadow at all while the live editor showed it. Framed screenshots were never
 * affected: they carry `data-editor-shadow-filter-target` and already render
 * their shadow through the filter chain, which WebKit does raster.
 *
 * The element keeps reading {@link SHADOW_FILTER_PREVIEW_VAR}, so an animated
 * shadow still updates per frame — only the property carrying it changes. The
 * converted committed value becomes the var's fallback, which is what shows
 * before the first frame's vars land and on a still export.
 *
 * A drop-shadow follows the painted alpha rather than the border box, so a
 * `contain`-fitted image with transparent letterboxing casts from the picture
 * instead of the box. That is the same trade every framed export already makes,
 * and it beats no shadow.
 */
export function redirectBoxShadowToFilter(node: HTMLElement): void {
  if (supportsObjectViewBox()) return

  const targets = node.querySelectorAll<HTMLElement>(
    "[data-editor-shadow-box-target]"
  )
  for (const el of targets) {
    const computed = getComputedStyle(el)
    const dropShadow = boxShadowToDropFilterCss(computed.boxShadow)
    if (!dropShadow) continue

    // Read the filter off the inline style, not the computed one: the inline
    // value is still the unresolved `var(...)` the grade sliders and the
    // animation frame write through, and baking the resolved value would
    // freeze the colour grade on whatever this instant happened to be.
    const existingFilter = el.style.filter
    const shadowLeg = `var(${SHADOW_FILTER_PREVIEW_VAR}, ${dropShadow})`
    el.style.boxShadow = "none"
    el.style.filter = existingFilter
      ? `${existingFilter} ${shadowLeg}`
      : shadowLeg
  }
}
