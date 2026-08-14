import type { ExportCaptureOptions } from "./export-constants"
import {
  flattenGlassChromeRing,
  neutralizeUnsupportedExportBackdropFilters,
} from "./export-glass"

const WATERMARK_PREFIX = "Designed by"
const WATERMARK_APP_NAME = "Tokokino"

export type ExportWatermarkLogoPlacement = {
  x: number
  y: number
  width: number
  height: number
}

function makeExportStyle(scopeId: string, neutralizePortraitFx = false) {
  const exportStyle = document.createElement("style")
  exportStyle.id = "__export-override"
  const scope = `[data-export-scope="${scopeId}"]`
  // Portrait blur/stage relies on backdrop-filter, which a rasterized
  // foreignObject can't composite. For animation capture we neutralize the
  // broken filter + tint (kept laid out for measurement) and re-draw the
  // depth-of-field onto the frame canvas afterward. Still exports don't get the
  // redraw, so they keep the overlay's own (partial) render instead.
  const portraitFx = neutralizePortraitFx
    ? `${scope} [data-export-portrait-fx] {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      background: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
    }`
    : ""
  // Do NOT zero `outline` globally — style borders use CSS outline on the
  // screenshot box. Only strip UI chrome (selection rings, focus rings, caret).
  exportStyle.textContent = `
    ${scope}, ${scope} * {
      caret-color: transparent !important;
      --tw-ring-shadow: 0 0 #0000 !important;
      --tw-ring-offset-shadow: 0 0 #0000 !important;
      animation: none !important;
      transition: none !important;
    }
    ${scope} [data-export-hidden="true"] { display: none !important; }
    ${scope} [data-selection-border="true"] {
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
    }
    ${portraitFx}
  `
  return exportStyle
}

function appendWatermark(node: HTMLElement, width: number, height: number) {
  const watermark = document.createElement("div")
  const prefix = document.createElement("span")
  // Keep only a layout placeholder in the foreignObject clone. WebKit can drop
  // decoded <img> subresources while rasterizing it, so the real logo is drawn
  // onto the finished canvas at this placeholder's measured position.
  const logo = document.createElement("span")
  const label = document.createElement("span")
  const minEdge = Math.max(1, Math.min(width, height))
  const scale = Math.max(0.72, Math.min(1.35, minEdge / 720))

  watermark.setAttribute("data-export-watermark", "true")
  watermark.style.position = "absolute"
  watermark.style.left = "50%"
  watermark.style.bottom = `${Math.round(8 * scale)}px`
  watermark.style.zIndex = "2147483647"
  watermark.style.display = "inline-flex"
  watermark.style.alignItems = "center"
  watermark.style.gap = `${Math.round(6 * scale)}px`
  watermark.style.padding = `${Math.round(3 * scale)}px ${Math.round(9 * scale)}px`
  watermark.style.borderRadius = `${Math.round(8 * scale)}px`
  watermark.style.background = "rgba(255, 255, 255, 0.14)"
  watermark.style.color = "rgba(255, 255, 255, 0.9)"
  watermark.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  watermark.style.fontSize = `${Math.round(13 * scale)}px`
  watermark.style.fontWeight = "650"
  watermark.style.lineHeight = "1"
  watermark.style.letterSpacing = "0"
  watermark.style.transform = "translateX(-50%)"
  watermark.style.pointerEvents = "none"
  watermark.style.textShadow = "0 1px 1px rgba(0, 0, 0, 0.16)"

  prefix.textContent = WATERMARK_PREFIX
  prefix.style.fontWeight = "500"
  prefix.style.opacity = "0.78"
  prefix.style.whiteSpace = "nowrap"

  logo.setAttribute("data-export-watermark-logo", "true")
  logo.setAttribute("aria-hidden", "true")
  logo.style.width = `${Math.round(20 * scale)}px`
  logo.style.height = `${Math.round(20 * scale)}px`
  logo.style.display = "block"
  logo.style.flexShrink = "0"

  label.textContent = WATERMARK_APP_NAME
  label.style.whiteSpace = "nowrap"

  watermark.appendChild(prefix)
  watermark.appendChild(logo)
  watermark.appendChild(label)
  node.appendChild(watermark)
}

export function measureExportWatermarkLogo(
  root: HTMLElement
): ExportWatermarkLogoPlacement | null {
  const logo = root.querySelector<HTMLElement>(
    '[data-export-watermark-logo="true"]'
  )
  if (!logo) return null

  const rootRect = root.getBoundingClientRect()
  const logoRect = logo.getBoundingClientRect()
  if (!(logoRect.width > 0) || !(logoRect.height > 0)) return null

  return {
    x: logoRect.left - rootRect.left,
    y: logoRect.top - rootRect.top,
    width: logoRect.width,
    height: logoRect.height,
  }
}

export function prepareExportNode(
  source: HTMLElement,
  width: number,
  height: number,
  options: ExportCaptureOptions = {},
  neutralizePortraitFx = false
) {
  const wrapper = document.createElement("div")
  const node = source.cloneNode(true) as HTMLElement
  const scopeId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const exportStyle = makeExportStyle(scopeId, neutralizePortraitFx)

  wrapper.style.position = "fixed"
  wrapper.style.left = "-100000px"
  wrapper.style.top = "0"
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.style.overflow = "hidden"
  wrapper.style.pointerEvents = "none"

  node.setAttribute("data-export-scope", scopeId)
  node.style.position = "relative"
  node.style.left = "0"
  node.style.top = "0"
  node.style.width = `${width}px`
  node.style.height = `${height}px`
  node.style.pointerEvents = "none"
  node.style.transform = "none"
  neutralizeUnsupportedExportBackdropFilters(node)

  document.head.appendChild(exportStyle)
  if (options.watermark) {
    appendWatermark(node, width, height)
  }
  wrapper.appendChild(node)
  document.body.appendChild(wrapper)
  // Reads computed styles, so it needs the clone laid out in the document.
  flattenGlassChromeRing(node)

  return {
    node,
    cleanup: () => {
      wrapper.remove()
      exportStyle.remove()
    },
  }
}
