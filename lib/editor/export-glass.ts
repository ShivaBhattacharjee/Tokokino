import { elementRotation, filterExportHidden } from "./export-dom"
import {
  UNDERLAY_SETTLE_MAX_ATTEMPTS,
  rasterizeExportNode,
} from "./export-settle"
import { blurRgba, saturateRgba } from "./image-blur"

/**
 * SVG foreignObject export cannot reliably composite the glass frame's
 * backdrop-filter against image/ASCII layers behind it. WebKit can expand the
 * blur beyond the translucent cards and soften the entire exported backdrop.
 * Keep the glass paint, borders, and shadows, but remove only that unsupported
 * blur from the detached export clone.
 */
export function neutralizeUnsupportedExportBackdropFilters(root: HTMLElement) {
  for (const layer of glassFrostLayers(root)) {
    layer.style.backdropFilter = "none"
    layer.style.setProperty("-webkit-backdrop-filter", "none")
  }
}

const INSET_RING_SHADOW =
  /^(rgba?\([^)]*\))\s+0px\s+0px\s+0px\s+([\d.]+)px\s+inset$/

/**
 * Redraw the glass frame's highlight ring as a border on the export clone.
 *
 * The chrome layer edges the panel with `inset 0 0 0 0.1cqw` — a sub-pixel
 * spread on a rounded rect, which the whole scene is then scaled by. WebKit
 * rasterizes that inside a `foreignObject` by flooding the corner instead of
 * tracing it, leaving a hard bright wedge a few pixels across where the top and
 * right edges turn. A border of the same width and colour on the same
 * border-box geometry is the identical ring and rounds cleanly.
 */
export function flattenGlassChromeRing(root: HTMLElement) {
  for (const chrome of Array.from(
    root.querySelectorAll<HTMLElement>('[data-glass-frame-layer="chrome"]')
  )) {
    const match = INSET_RING_SHADOW.exec(
      window.getComputedStyle(chrome).boxShadow.trim()
    )
    if (!match) continue
    const [, color, width] = match
    chrome.style.boxShadow = "none"
    chrome.style.border = `${width}px solid ${color}`
    // The ring now eats into the padding box; keep the sheen gradient spanning
    // the same rect it did as a shadow.
    chrome.style.backgroundOrigin = "border-box"
    chrome.style.backgroundClip = "border-box"
  }
}

/** Glass panes that frost what is behind them — the frame chrome does not. */
function glassFrostLayers(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-glass-frame-layer]")
  ).filter((layer) => layer.dataset.glassFrameLayer !== "chrome")
}

/** The pane's blur, matching `glassBackdropStyle` in `components/ui/glass-frame`. */
const GLASS_FROST_BLUR_PX = 18
const GLASS_FROST_SATURATE = 1.35
/** The scene behind the panes is only ever read through an 18px blur. */
const GLASS_FROST_UNDERLAY_MAX_WIDTH = 960
const GLASS_FROST_TEXTURE_MAX_WIDTH = 480

/**
 * Draw the underlay, then repeat its outermost pixels outward by `pad`.
 *
 * The blur that follows samples past the scene's edges; without the skirt those
 * samples come back transparent and pull a dark halo into any pane that reaches
 * the canvas border. This is the clamp-to-edge the GPU would do for free.
 */
function drawUnderlayWithSkirt(
  ctx: CanvasRenderingContext2D,
  underlay: HTMLCanvasElement,
  width: number,
  height: number,
  pad: number
): void {
  const sw = underlay.width
  const sh = underlay.height
  if (!sw || !sh) return

  ctx.drawImage(underlay, 0, 0, sw, 1, 0, -pad, width, pad)
  ctx.drawImage(underlay, 0, sh - 1, sw, 1, 0, height, width, pad)
  ctx.drawImage(underlay, 0, 0, 1, sh, -pad, 0, pad, height)
  ctx.drawImage(underlay, sw - 1, 0, 1, sh, width, 0, pad, height)
  ctx.drawImage(underlay, 0, 0, 1, 1, -pad, -pad, pad, pad)
  ctx.drawImage(underlay, sw - 1, 0, 1, 1, width, -pad, pad, pad)
  ctx.drawImage(underlay, 0, sh - 1, 1, 1, -pad, height, pad, pad)
  ctx.drawImage(underlay, sw - 1, sh - 1, 1, 1, width, height, pad, pad)
  ctx.drawImage(underlay, 0, 0, width, height)
}

/**
 * Rasterize the scene as the pane at `index` sees it: every pane from `index`
 * upward hidden, everything below it left alone. The screen lives inside the
 * front shell, so hiding that shell also takes the screenshot out — which is
 * right, since nothing above a pane belongs in its frost.
 */
async function rasterizeUnderlayBelow(
  node: HTMLElement,
  painted: HTMLElement[],
  index: number,
  renderedWidth: number,
  renderedHeight: number,
  underlayWidth: number,
  underlayHeight: number
): Promise<HTMLCanvasElement | null> {
  const hidden = painted.slice(index)
  const authored = hidden.map((layer) => layer.style.visibility)
  for (const layer of hidden) layer.style.visibility = "hidden"
  try {
    return await rasterizeExportNode(
      node,
      { cacheBust: false, filter: filterExportHidden },
      renderedWidth,
      renderedHeight,
      underlayWidth,
      underlayHeight,
      undefined,
      UNDERLAY_SETTLE_MAX_ATTEMPTS
    )
  } catch {
    return null
  } finally {
    hidden.forEach((layer, i) => {
      layer.style.visibility = authored[i]
    })
  }
}

/**
 * Paint each glass pane's frost into the clone as a background image.
 *
 * `backdrop-filter` does not survive a `foreignObject` raster in any engine —
 * WebKit drops it, Chromium spreads the blur across the whole exported
 * backdrop — so the export neutralizes it. Without a replacement the panes
 * composite as clear glass and the background reads through them sharp, which
 * is not what the editor shows. Substituting an opaque gradient (what this used
 * to do) is worse: it erases the translucency entirely.
 *
 * So the frost is rendered for real, before serialization: rasterize what sits
 * behind a pane, sample that underlay through the pane's own transform, blur it
 * in `image-blur`, and slide it under the authored translucent gradient. The
 * underlays and the per-pane textures are both small — everything is read
 * through an 18px blur, so resolution beyond that is wasted bytes in an already
 * multi-megabyte SVG.
 *
 * "Behind" is per pane, not shared: the panes are stacked and offset, so the
 * front shell frosts the rear panes showing through it while a rear pane frosts
 * only the canvas. One underlay for all of them left the shell's border — a few
 * pixels of glass around the screen, on every side — frosting bare background
 * and reading a flat wrong colour against the editor. So the underlay is
 * re-rasterized in paint order, each pane seeing exactly the panes below it.
 */
export async function bakeGlassFrost(
  node: HTMLElement,
  renderedWidth: number,
  renderedHeight: number
): Promise<void> {
  const layers = glassFrostLayers(node)
  if (layers.length === 0 || renderedWidth <= 0 || renderedHeight <= 0) return

  // Paint order, so hiding a suffix of the list leaves exactly what is below.
  const painted = layers
    .map((layer) => ({
      layer,
      z: Number(window.getComputedStyle(layer).zIndex) || 0,
    }))
    .sort((a, b) => a.z - b.z)
    .map((entry) => entry.layer)

  const scale = Math.min(1, GLASS_FROST_UNDERLAY_MAX_WIDTH / renderedWidth)
  const underlayWidth = Math.max(1, Math.round(renderedWidth * scale))
  const underlayHeight = Math.max(1, Math.round(renderedHeight * scale))

  const rootRect = node.getBoundingClientRect()

  for (const [index, layer] of painted.entries()) {
    const underlay = await rasterizeUnderlayBelow(
      node,
      painted,
      index,
      renderedWidth,
      renderedHeight,
      underlayWidth,
      underlayHeight
    )
    if (!underlay) continue

    const localWidth = layer.offsetWidth
    const localHeight = layer.offsetHeight
    if (!localWidth || !localHeight) continue

    // Rotation is about the pane's centre, so the transform leaves it put.
    const rect = layer.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2 - rootRect.left
    const centerY = rect.top + rect.height / 2 - rootRect.top

    const textureScale = Math.min(
      scale,
      GLASS_FROST_TEXTURE_MAX_WIDTH / localWidth
    )
    const textureWidth = Math.max(1, Math.round(localWidth * textureScale))
    const textureHeight = Math.max(1, Math.round(localHeight * textureScale))

    const sigma = GLASS_FROST_BLUR_PX * textureScale
    // Blur reaches ~3σ, so the texture is sampled with that much margin and
    // cropped back afterwards — otherwise every pane's own edge would bleed
    // transparency inward and read as a dark rim.
    const pad = Math.ceil(sigma * 3)
    const padded = document.createElement("canvas")
    padded.width = textureWidth + pad * 2
    padded.height = textureHeight + pad * 2
    const paddedCtx = padded.getContext("2d", { willReadFrequently: true })
    if (!paddedCtx) continue

    // Map the underlay into the pane's local box: centre it, undo the pane's
    // rotation, then offset by where the pane sits in the scene.
    paddedCtx.translate(pad + textureWidth / 2, pad + textureHeight / 2)
    paddedCtx.rotate(-elementRotation(layer))
    paddedCtx.translate(-centerX * textureScale, -centerY * textureScale)
    drawUnderlayWithSkirt(
      paddedCtx,
      underlay,
      renderedWidth * textureScale,
      renderedHeight * textureScale,
      pad
    )

    let frostUrl: string
    try {
      const image = paddedCtx.getImageData(0, 0, padded.width, padded.height)
      blurRgba(image.data, padded.width, padded.height, sigma)
      saturateRgba(image.data, GLASS_FROST_SATURATE)
      paddedCtx.setTransform(1, 0, 0, 1, 0, 0)
      paddedCtx.putImageData(image, 0, 0)

      const canvas = document.createElement("canvas")
      canvas.width = textureWidth
      canvas.height = textureHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) continue
      ctx.drawImage(
        padded,
        pad,
        pad,
        textureWidth,
        textureHeight,
        0,
        0,
        textureWidth,
        textureHeight
      )
      frostUrl = canvas.toDataURL("image/png")
    } catch {
      // Reading the pixels back throws on a tainted canvas. Leave this pane as
      // clear glass rather than failing the export or the clipboard copy over
      // an effect — the same call the frost needs is how the export is encoded,
      // so a pane losing it is the softest way for that to surface.
      continue
    }

    const authored = layer.style.backgroundImage
    // Authored gradient first: background layers paint front to back.
    layer.style.backgroundImage =
      authored && authored !== "none"
        ? `${authored}, url("${frostUrl}")`
        : `url("${frostUrl}")`
    layer.style.backgroundSize = "100% 100%"
    layer.style.backgroundRepeat = "no-repeat"
    layer.style.backgroundPosition = "center"
  }
}
