import { getFontEmbedCSS } from "html-to-image"

import { waitForAsciiBackdrops } from "./ascii-backdrop"
import { supportsObjectViewBox } from "./crop-utils"
import {
  rewriteExportAssets,
  waitForExportAssets,
} from "./export-asset-rewrite"
import { prepareExportNode } from "./export-clone"
import {
  exportElementLayoutSize,
  filterExportHidden,
  findCanvasElement,
  getCanvasLayoutDims,
} from "./export-dom"
import {
  embedCloneBackgroundImages,
  embedCloneImages,
  readBlobAsDataUrl,
  waitForImageElement,
} from "./export-embed"
import {
  canvasToBlob,
  exportScaleStyle,
  rasterizeNodeToCanvas,
} from "./export-raster"
import { isRasterEssentiallyEmpty, settleDelayMs } from "./export-settle"

/**
 * Prepare an offscreen clone of the canvas for repeated frame capture (used by
 * Animate-mode video/GIF export). The clone is set up once (assets rewritten,
 * fonts/images embedded); the caller then mutates it per frame — typically by
 * writing the `--anim-*` CSS vars the screenshot wrapper reads — and calls
 * `captureFrame()` to snapshot the current state. Call `cleanup()` when done.
 */
export type AnimationCapture = {
  node: HTMLElement
  width: number
  height: number
  /**
   * True when the caller must wait for a browser paint after mutating the clone
   * before `captureFrame()` reflects the change. The html-to-image path reads
   * live computed styles (needs paint); the fast serialize-once path reads the
   * clone's inline styles synchronously, so it sets this false and the per-frame
   * paint wait is skipped.
   */
  needsPaint: boolean
  captureFrame: () => Promise<HTMLCanvasElement>
  cleanup: () => void
}

/**
 * How many times to re-raster an ASCII glyph tree that came back blank. The
 * glyphs are painted entirely through a data-URI SVG mask, which is exactly the
 * subresource WebKit will report as loaded before it has decoded — so the first
 * raster can be empty even though the layer renders perfectly on screen.
 */
const ASCII_RASTER_MAX_ATTEMPTS = 6

/**
 * Rasterize one ASCII glyph tree, retrying while the result is blank.
 *
 * Returns null if every attempt came back empty, which leaves the caller with
 * the original glyph DOM — slower to capture, but it still paints, and the
 * per-frame capture has its own WebKit warm-up. Flattening a blank raster in
 * would delete the ASCII treatment from every frame of the export.
 */
async function rasterizeAsciiGlyphs(
  glyphTree: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number
): Promise<HTMLCanvasElement | null> {
  const outWidth = Math.max(1, Math.round(width * pixelRatio))
  const outHeight = Math.max(1, Math.round(height * pixelRatio))
  for (let attempt = 1; attempt <= ASCII_RASTER_MAX_ATTEMPTS; attempt++) {
    const raster = await rasterizeNodeToCanvas(
      glyphTree,
      { cacheBust: false },
      width,
      height,
      outWidth,
      outHeight
    )
    if (!isRasterEssentiallyEmpty(raster)) return raster
    if (supportsObjectViewBox()) return null
    await new Promise((resolve) => setTimeout(resolve, settleDelayMs(attempt)))
  }
  return null
}

/**
 * Replace each ASCII glyph tree in an animation clone with one transparent,
 * output-resolution PNG. The outer ASCII layer stays in the DOM so its plate,
 * filter, user opacity, and timeline crossfade keep their original geometry.
 */
export async function flattenAnimationAsciiLayers(
  node: HTMLElement,
  renderedWidth: number,
  outputWidth: number
): Promise<void> {
  const glyphTrees = Array.from(
    node.querySelectorAll<HTMLElement>('[data-export-ascii-glyphs="true"]')
  )
  if (glyphTrees.length === 0 || renderedWidth <= 0 || outputWidth <= 0) return

  const pixelRatio = outputWidth / renderedWidth
  for (const glyphTree of glyphTrees) {
    const size = exportElementLayoutSize(glyphTree)
    if (!size) continue
    const { width, height } = size

    try {
      const raster = await rasterizeAsciiGlyphs(
        glyphTree,
        width,
        height,
        pixelRatio
      )
      if (!raster) continue
      const dataUrl = await readBlobAsDataUrl(
        await canvasToBlob(raster, "image/png")
      )
      const image = document.createElement("img")
      image.src = dataUrl
      image.alt = ""
      image.draggable = false
      image.setAttribute("aria-hidden", "true")
      image.style.display = "block"
      image.style.width = `${width}px`
      image.style.height = `${height}px`
      image.style.maxWidth = "none"
      image.style.pointerEvents = "none"
      await waitForImageElement(image)
      glyphTree.replaceWith(image)
    } catch {
      // Keep the original glyph DOM so one failed optimisation cannot fail the
      // export or remove the ASCII treatment from the affected keyframe.
    }
  }
}

/**
 * WebKit loads an SVG image's subresources (e.g. the data-URI SVG backgrounds
 * the mesh/aurora/grain presets are built from) asynchronously, so the first
 * foreignObject rasterizations can miss them — Safari video exports came out
 * with a black background. Discarded warm-up captures give the decode time and
 * prime WebKit's image cache so every real frame paints the full scene.
 * No-op on Chromium.
 */
async function warmUpWebKitCapture(captureFrame: () => Promise<unknown>) {
  if (supportsObjectViewBox()) return
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await captureFrame()
    } catch {
      // Warm-up only — the real capture surfaces its own errors.
    }
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
}

export async function prepareAnimationCapture(
  canvasId: string,
  targetWidth = 1280
): Promise<AnimationCapture> {
  // ASCII backdrops paint their glyphs from an async sample of the background,
  // and the export clone below is a snapshot React never renders into again —
  // so this must happen BEFORE prepareExportNode, not before the rasterize.
  await waitForAsciiBackdrops()
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const layoutDims = getCanvasLayoutDims(node)
  if (!layoutDims) throw new Error("Canvas has zero width")
  const { width: renderedWidth, height: renderedHeight } = layoutDims

  const pixelRatio = targetWidth / renderedWidth
  const outputWidth = Math.round(renderedWidth * pixelRatio)
  const outputHeight = Math.round(renderedHeight * pixelRatio)

  const exportTarget = prepareExportNode(
    node,
    renderedWidth,
    renderedHeight,
    {},
    true // neutralize portrait blur/stage — redrawn onto the frame canvas
  )
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)

  await waitForExportAssets(preloadUrls)
  await embedCloneImages(exportTarget.node)
  // Animation export reuses this clone for hundreds of captures while mutating
  // the crossfade layers' opacity. Remote background-images must be inlined as
  // data URIs or html-to-image caches them and freezes the animated background
  // on one frame — see embedCloneBackgroundImages.
  await embedCloneBackgroundImages(exportTarget.node)
  await flattenAnimationAsciiLayers(
    exportTarget.node,
    renderedWidth,
    outputWidth
  )

  const captureOptions = {
    cacheBust: false,
    filter: filterExportHidden,
  } as const

  const captureFrame = async () => {
    // html-to-image can return a non-canvas / zero-size value on Safari &
    // Firefox. Validate before handing it to drawImage callers.
    const canvas = await rasterizeNodeToCanvas(
      exportTarget.node,
      captureOptions,
      renderedWidth,
      renderedHeight,
      outputWidth,
      outputHeight
    )
    if (
      !(canvas instanceof HTMLCanvasElement) ||
      canvas.width <= 0 ||
      canvas.height <= 0
    ) {
      throw new Error("Frame capture returned an invalid canvas")
    }
    return canvas
  }

  await warmUpWebKitCapture(captureFrame)

  return {
    node: exportTarget.node,
    width: outputWidth,
    height: outputHeight,
    needsPaint: true,
    captureFrame,
    cleanup: () => {
      for (const rewrite of rewrites.reverse()) rewrite.restore()
      exportTarget.cleanup()
    },
  }
}

const XHTML_NS = "http://www.w3.org/1999/xhtml"
const SVG_NS = "http://www.w3.org/2000/svg"

/**
 * Concatenate every same-origin stylesheet's rules into one CSS string — the
 * app's real cascade (Tailwind utilities, component rules, the export override,
 * `:root` theme vars, `::before/::after` overlays). Cross-origin sheets throw on
 * `.cssRules` and are skipped; web fonts are embedded separately.
 */
function collectDocumentCss(): string {
  let css = ""
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin — not readable
    }
    if (!rules) continue
    for (const rule of Array.from(rules)) css += rule.cssText + "\n"
  }
  return css
}

/**
 * Serialize a computed style declaration to a `prop:value;` string. Cross-browser
 * safe: `getComputedStyle().cssText` is empty in Chrome/Safari/Firefox, so we
 * enumerate the resolved longhands (which never include custom properties).
 */
function computedStyleText(computed: CSSStyleDeclaration): string {
  if (computed.cssText) return computed.cssText
  let text = ""
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i]
    text += `${prop}:${computed.getPropertyValue(prop)};`
  }
  return text
}

type ContainerContext = { type: string; width: number; height: number }

/**
 * Walk up from `node` to the nearest ancestor that establishes a query container
 * (`container-type: size | inline-size`) and return its type + layout size. The
 * canvas node itself is not the container — `data-editor-canvas-surface` is, an
 * ancestor the export clone leaves behind. Recreating a same-sized container
 * around the clone makes `cqw`/`cqh` reads resolve to the same pixels as on
 * screen (e.g. the framed main's animated anchor position).
 */
function findNearestContainerContext(
  node: HTMLElement
): ContainerContext | null {
  let el = node.parentElement
  while (el) {
    const containerType = window.getComputedStyle(el).containerType
    if (containerType && containerType !== "normal") {
      return {
        type: containerType,
        width: el.offsetWidth,
        height: el.offsetHeight,
      }
    }
    el = el.parentElement
  }
  return null
}

/**
 * Bake every element's resolved computed style inline for one serialized frame,
 * then restore the authored (var-driven) inline styles.
 *
 * This is what makes the fast path render correctly: the clone lives inside the
 * real `<html class="dark">` and a recreated container context, so
 * `getComputedStyle` resolves theme colors AND `cqw`/`cqh` (dynamic per frame)
 * to concrete values. The serialized SVG then carries only absolute values and
 * renders identically in Chrome, Safari, and Firefox — no dependency on the
 * theme class or `@container` resolving inside a rasterized `<foreignObject>`.
 *
 * Author-set `--*` vars are re-appended (computed style never lists them) so
 * pseudo-elements that read one still resolve, and the authored inline styles are
 * restored afterward so the next frame's var writes still take effect.
 */
function withBakedComputedStyles<T>(els: HTMLElement[], serialize: () => T): T {
  const authored = els.map((el) => el.getAttribute("style"))
  // Read every computed style first (a later setAttribute can invalidate layout,
  // but resolved values are absolute so a cached read stays correct).
  const baked = els.map((el) => {
    let text = computedStyleText(window.getComputedStyle(el))
    const inline = el.style
    for (let j = 0; j < inline.length; j++) {
      const prop = inline[j]
      if (prop.startsWith("--"))
        text += `${prop}:${inline.getPropertyValue(prop)};`
    }
    return text
  })
  for (let i = 0; i < els.length; i++) els[i].setAttribute("style", baked[i])
  try {
    return serialize()
  } finally {
    for (let i = 0; i < els.length; i++) {
      const original = authored[i]
      if (original === null) els[i].removeAttribute("style")
      else els[i].setAttribute("style", original)
    }
  }
}

/**
 * Fast animation capture.
 *
 * The html-to-image path (`prepareAnimationCapture`) deep-clones the DOM, embeds
 * fonts/images, and re-inlines computed styles on EVERY frame. Here the clone and
 * its embedded assets/fonts/stylesheet are set up a SINGLE time and reused; each
 * frame we only bake the (already-laid-out) clone's computed styles and serialize
 * it into a `<foreignObject>` SVG — skipping the re-clone, the asset re-embedding,
 * and the double-`requestAnimationFrame` paint wait. Correct for every canvas
 * (theme + container queries are resolved by the bake), device frames included.
 */
export async function prepareFastAnimationCapture(
  canvasId: string,
  targetWidth = 1280
): Promise<AnimationCapture> {
  // ASCII backdrops paint their glyphs from an async sample of the background,
  // and the export clone below is a snapshot React never renders into again —
  // so this must happen BEFORE prepareExportNode, not before the rasterize.
  await waitForAsciiBackdrops()
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const layoutDims = getCanvasLayoutDims(node)
  if (!layoutDims) throw new Error("Canvas has zero width")
  const { width: renderedWidth, height: renderedHeight } = layoutDims

  const pixelRatio = targetWidth / renderedWidth
  const outputWidth = Math.round(renderedWidth * pixelRatio)
  const outputHeight = Math.round(renderedHeight * pixelRatio)

  // Read the on-screen container context BEFORE cloning so cqw reads on the clone
  // resolve to the same pixels as in the live editor.
  const containerContext = findNearestContainerContext(node)

  const exportTarget = prepareExportNode(
    node,
    renderedWidth,
    renderedHeight,
    {},
    true // neutralize portrait blur/stage — redrawn onto the frame canvas
  )
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)

  // Recreate the query container around the clone (its wrapper) so per-frame
  // computed-style reads resolve cqw/cqh identically to on screen.
  const wrapper = exportTarget.node.parentElement
  if (wrapper && containerContext) {
    wrapper.style.containerType = containerContext.type
    wrapper.style.width = `${containerContext.width}px`
    wrapper.style.height = `${containerContext.height}px`
    wrapper.style.display = "block"
    exportTarget.node.style.position = "absolute"
    exportTarget.node.style.top = "0"
    exportTarget.node.style.left = "0"
  }

  await waitForExportAssets(preloadUrls)
  // Every image/background must be a data URI: the isolated SVG render can't load
  // remote/blob resources and cross-origin ones would taint the canvas (GIF
  // export reads it back via getImageData).
  await embedCloneImages(exportTarget.node)
  await embedCloneBackgroundImages(exportTarget.node)
  await flattenAnimationAsciiLayers(
    exportTarget.node,
    renderedWidth,
    outputWidth
  )

  // Element list for the per-frame computed-style bake (root + all descendants).
  // Re-read every frame rather than cached once: callers swap nodes into the
  // clone between captures (the video layer replaces the `<video>` with an
  // `<img>`), and a stale list would leave those unbaked — i.e. rendered without
  // the resolved theme colors and cqw/cqh this path depends on. The walk is
  // negligible next to the getComputedStyle pass it feeds.
  const bakeEls = () => [
    exportTarget.node,
    ...Array.from(exportTarget.node.querySelectorAll<HTMLElement>("*")),
  ]

  // foreignObject content must be namespaced XHTML for the XML serializer.
  exportTarget.node.setAttribute("xmlns", XHTML_NS)

  // Captured once — the expensive parts. Document CSS first, then the data-URI
  // web fonts LAST so they win the cascade over the app's own same-origin
  // `@font-face url(...)` rules (which the isolated render can't fetch). CDATA
  // keeps CSS (`<`, `&`, `>` from combinators/nesting) intact through XML parse.
  const fontCss = await getFontEmbedCSS(exportTarget.node).catch(() => "")
  const css = `${collectDocumentCss()}\n${fontCss}`

  // The SVG stays 1:1 with the output and a CSS transform on a wrapper carries
  // the scale — WebKit ignores a viewBox transform on foreignObject content and
  // would paint the whole scene at 1× in the top-left. See exportScaleStyle.
  const scaleStyle = exportScaleStyle(renderedWidth, renderedHeight, pixelRatio)
  const svgOpen =
    `<svg xmlns="${SVG_NS}" width="${outputWidth}" height="${outputHeight}"` +
    ` viewBox="0 0 ${outputWidth} ${outputHeight}">` +
    `<foreignObject x="0" y="0" width="${outputWidth}" height="${outputHeight}">` +
    `<style xmlns="${XHTML_NS}"><![CDATA[${css}]]></style>` +
    `<div xmlns="${XHTML_NS}" style="width:${scaleStyle.width};` +
    `height:${scaleStyle.height};transform:${scaleStyle.transform};` +
    `transform-origin:${scaleStyle.transformOrigin};">`
  const svgClose = `</div></foreignObject></svg>`
  // Pre-encode the constant (large) prefix/suffix so only the small per-frame
  // body is URL-encoded each frame.
  const dataUrlHead = `data:image/svg+xml;charset=utf-8,`
  const encodedOpen = encodeURIComponent(svgOpen)
  const encodedClose = encodeURIComponent(svgClose)

  const serializer = new XMLSerializer()
  const frameCanvas = document.createElement("canvas")
  frameCanvas.width = outputWidth
  frameCanvas.height = outputHeight
  const ctx = frameCanvas.getContext("2d")
  if (!ctx) {
    exportTarget.cleanup()
    throw new Error("Could not get 2d context for fast capture")
  }

  const captureFrame = async () => {
    // Bake computed styles (resolving theme colors + cqw → px for this frame)
    // just for the serialization, then restore the var-driven inline styles.
    const body = withBakedComputedStyles(bakeEls(), () =>
      serializer.serializeToString(exportTarget.node)
    )
    const url =
      dataUrlHead + encodedOpen + encodeURIComponent(body) + encodedClose
    // `Image.decode()` rejects on SVG-with-<foreignObject> in some Firefox
    // builds, so wait on load/error events — reliable in every engine.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () =>
        reject(new Error("Fast capture: SVG frame failed to load"))
      image.src = url
    })
    ctx.clearRect(0, 0, outputWidth, outputHeight)
    // 1:1 — the SVG is already output-sized, nothing left for drawImage to scale.
    ctx.drawImage(img, 0, 0, outputWidth, outputHeight)
    return frameCanvas
  }

  await warmUpWebKitCapture(captureFrame)

  return {
    node: exportTarget.node,
    width: outputWidth,
    height: outputHeight,
    needsPaint: false,
    captureFrame,
    cleanup: () => {
      for (const rewrite of rewrites.reverse()) rewrite.restore()
      exportTarget.cleanup()
    },
  }
}
