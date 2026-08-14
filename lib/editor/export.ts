import { toSvg, getFontEmbedCSS } from "html-to-image"

import { triggerAnchorDownload } from "@/lib/download"
import { waitForAsciiBackdrops } from "./ascii-backdrop"
import { supportsObjectViewBox } from "./crop-utils"
import { shouldProxyAssetUrl } from "./export-assets"
import { blurRgba, saturateRgba } from "./image-blur"
import { replaceCloneVideosWithFrames } from "./export-video-frames"
import {
  buildExportFilename,
  getExportFilenameFormat,
  getExportTemplateLabel,
} from "./export-filename"

export { shouldProxyAssetUrl } from "./export-assets"

export type ExportFormat = "png" | "jpeg" | "webp"
export type ExportResolution = "hd" | "4k" | "8k"
export type CopyResolution = "1080p"
export type ExportCaptureOptions = {
  watermark?: boolean
}

export const EXPORT_RESOLUTION_WIDTHS: Record<ExportResolution, number> = {
  hd: 1920,
  "4k": 3840,
  "8k": 7680,
}

export const EXPORT_RESOLUTION_LABELS: Record<ExportResolution, string> = {
  hd: "HD",
  "4k": "4K",
  "8k": "8K",
}

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
}

export const EXPORT_FORMAT_EXTENSION: Record<ExportFormat, string> = {
  png: ".png",
  jpeg: ".jpeg",
  webp: ".webp",
}

export const COPY_RESOLUTION_WIDTHS: Record<CopyResolution, number> = {
  "1080p": 1080,
}

export const SHARE_RESOLUTION_WIDTH = 1920

const WATERMARK_LOGO_SRC = "/logo.png"
const WATERMARK_PREFIX = "Designed by"
const WATERMARK_APP_NAME = "Tokokino"

function findCanvasElement(canvasId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-canvas-id="${canvasId}"]`)
}

/**
 * Return the CSS layout dimensions of the canvas element, ignoring any
 * ancestor transforms (viewport zoom/scale). We use offsetWidth/offsetHeight
 * which give the border-box size in CSS pixels before transforms are applied.
 * This is important because container-query units (cqw / cqh) used by device
 * mockup frames resolve against CSS dimensions, not transformed/visual ones.
 */
function getCanvasLayoutDims(node: HTMLElement): {
  width: number
  height: number
} | null {
  const width = node.offsetWidth
  const height = node.offsetHeight
  if (!width || !height) return null
  return { width, height }
}

export function getCanvasRenderedDims(canvasId: string): {
  width: number
  height: number
} | null {
  const node = findCanvasElement(canvasId)
  if (!node) return null
  return getCanvasLayoutDims(node)
}

export function getOutputDims(
  canvasId: string,
  resolution: ExportResolution
): { width: number; height: number } | null {
  const dims = getCanvasRenderedDims(canvasId)
  if (!dims) return null
  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const ratio = targetWidth / dims.width
  return {
    width: Math.round(targetWidth),
    height: Math.round(dims.height * ratio),
  }
}

function triggerDownload(url: string, filename: string) {
  triggerAnchorDownload(url, filename)
}

type AssetRewrite = {
  restore: () => void
}

const URL_FUNCTION_RE = /url\((['"]?)(.*?)\1\)/g
const EXPORT_IMAGE_PROXY_PATH = "/api/export/image"
const EXPORT_ASSET_PRELOAD_TIMEOUT_MS = 12_000

function proxiedAssetUrl(value: string) {
  const absoluteUrl = new URL(value, window.location.href).toString()
  const params = new URLSearchParams({ url: absoluteUrl })
  return `${EXPORT_IMAGE_PROXY_PATH}?${params.toString()}`
}

function rewriteCssUrls(value: string): { value: string; urls: string[] } {
  const urls: string[] = []
  const rewritten = value.replace(
    URL_FUNCTION_RE,
    (match: string, quote: string, rawUrl: string) => {
      if (!shouldProxyAssetUrl(rawUrl)) return match
      const proxied = proxiedAssetUrl(rawUrl)
      urls.push(proxied)
      return `url(${quote || '"'}${proxied}${quote || '"'})`
    }
  )
  return { value: rewritten, urls }
}

function rewriteExportAssets(root: HTMLElement): {
  rewrites: AssetRewrite[]
  preloadUrls: string[]
} {
  const rewrites: AssetRewrite[] = []
  const preloadUrls: string[] = []

  for (const img of Array.from(root.querySelectorAll("img"))) {
    const currentSrc = img.getAttribute("src")
    if (!currentSrc || !shouldProxyAssetUrl(currentSrc)) continue

    const nextSrc = proxiedAssetUrl(currentSrc)
    const previousSrc = currentSrc
    const previousCrossOrigin = img.getAttribute("crossorigin")

    img.setAttribute("src", nextSrc)
    img.setAttribute("crossorigin", "anonymous")
    preloadUrls.push(nextSrc)

    rewrites.push({
      restore: () => {
        img.setAttribute("src", previousSrc)
        if (previousCrossOrigin === null) {
          img.removeAttribute("crossorigin")
        } else {
          img.setAttribute("crossorigin", previousCrossOrigin)
        }
      },
    })
  }

  // Swap background thumbnail → full-res source URL for elements that carry
  // data-bg-source-url. The editor renders the thumb for perf; export needs
  // the full image so the output isn't blurry.
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>("[data-bg-source-url]")
  )) {
    const sourceUrl = el.getAttribute("data-bg-source-url")
    if (!sourceUrl) continue
    const exportUrl = shouldProxyAssetUrl(sourceUrl)
      ? proxiedAssetUrl(sourceUrl)
      : sourceUrl
    const previousValue = el.style.backgroundImage
    el.style.backgroundImage = `url("${exportUrl}")`
    preloadUrls.push(exportUrl)
    rewrites.push({
      restore: () => {
        el.style.backgroundImage = previousValue
      },
    })
  }

  const styleProps = [
    "backgroundImage",
    "borderImageSource",
    "listStyleImage",
    "maskImage",
    "webkitMaskImage",
  ] as const

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    for (const prop of styleProps) {
      const currentValue = el.style[prop]
      if (!currentValue || currentValue === "none") continue

      const { value: nextValue, urls } = rewriteCssUrls(currentValue)
      if (nextValue === currentValue) continue

      const previousValue = currentValue
      el.style[prop] = nextValue
      preloadUrls.push(...urls)

      rewrites.push({
        restore: () => {
          el.style[prop] = previousValue
        },
      })
    }
  }

  return { rewrites, preloadUrls }
}

async function waitForExportAssets(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls))
  await Promise.all(
    uniqueUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image()
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            resolve()
          }
          const timeoutId = window.setTimeout(
            finish,
            EXPORT_ASSET_PRELOAD_TIMEOUT_MS
          )
          image.crossOrigin = "anonymous"
          image.onload = finish
          image.onerror = finish
          image.src = url
        })
    )
  )
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("FileReader did not return a string"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"))
    reader.readAsDataURL(blob)
  })
}

async function waitForImageElement(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return
  await new Promise<void>((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true })
    img.addEventListener("error", () => resolve(), { once: true })
  })
}

/**
 * Inline every <img> in the export clone as a data URL. Preloading assets in
 * separate Image() objects does not update the cloned DOM nodes, so html-to-image
 * can otherwise paint stale decoded frames when a reused <img> src changes
 * between tweets (e.g. avatar from the previous post).
 */
async function embedCloneImages(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src")
      if (!src) return

      if (!src.startsWith("data:")) {
        try {
          const response = await fetch(src, { credentials: "omit" })
          if (response.ok) {
            const dataUrl = await readBlobAsDataUrl(await response.blob())
            img.src = dataUrl
            img.removeAttribute("crossorigin")
          }
        } catch {
          /* keep original src and wait below */
        }
      }

      await waitForImageElement(img)
    })
  )
}

/**
 * Inline every CSS `background-image: url(...)` in the clone as a data URI.
 *
 * Animation export reuses ONE clone and calls html-to-image ~200 times, mutating
 * the crossfade layers' opacity between captures. html-to-image caches fetched
 * remote images and, with a reused node, pins each background-image element's
 * rendered state to the FIRST capture — so opacity changes on those elements
 * never register and the exported background freezes on a single frame. Embedding
 * the images as data URIs removes the fetch (and its cache) entirely, so every
 * frame re-reads the current opacity. (`<img>` layers are handled by
 * `embedCloneImages`; this is the background-image equivalent.)
 */
async function embedCloneBackgroundImages(root: HTMLElement): Promise<void> {
  const cache = new Map<string, Promise<string | null>>()
  const fetchDataUrl = (url: string): Promise<string | null> => {
    const existing = cache.get(url)
    if (existing) return existing
    const p = (async () => {
      try {
        const response = await fetch(url, { credentials: "omit" })
        if (!response.ok) return null
        return await readBlobAsDataUrl(await response.blob())
      } catch {
        return null
      }
    })()
    cache.set(url, p)
    return p
  }

  const jobs: Promise<void>[] = []
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const value = el.style.backgroundImage
    if (!value || !value.includes("url(")) continue
    const matches = Array.from(value.matchAll(URL_FUNCTION_RE))
    if (matches.length === 0) continue
    jobs.push(
      (async () => {
        let next = value
        for (const m of matches) {
          const raw = m[2]
          if (!raw || raw.startsWith("data:")) continue
          const dataUrl = await fetchDataUrl(raw)
          if (dataUrl) next = next.split(m[0]).join(`url("${dataUrl}")`)
        }
        if (next !== value) el.style.backgroundImage = next
      })()
    )
  }
  await Promise.all(jobs)
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
  const logo = document.createElement("img")
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

  logo.src = WATERMARK_LOGO_SRC
  logo.alt = ""
  logo.style.width = `${Math.round(20 * scale)}px`
  logo.style.height = `${Math.round(20 * scale)}px`
  logo.style.display = "block"
  logo.style.filter = "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.18))"

  label.textContent = WATERMARK_APP_NAME
  label.style.whiteSpace = "nowrap"

  watermark.appendChild(prefix)
  watermark.appendChild(logo)
  watermark.appendChild(label)
  node.appendChild(watermark)
}

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

/** Rotation of an element's computed transform, in radians. */
export function elementRotation(el: HTMLElement): number {
  const transform = window.getComputedStyle(el).transform
  const values = /matrix(?:3d)?\(([^)]+)\)/.exec(transform)?.[1]
  if (!values) return 0
  const parts = values.split(",").map(Number)
  if (parts.length !== 6 && parts.length !== 16) return 0
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return 0
  return Math.atan2(parts[1], parts[0])
}

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
async function bakeGlassFrost(
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

function prepareExportNode(
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

function getNodeBorderRadius(node: HTMLElement): number {
  return parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
}

async function clipCanvasToRoundedRect(
  source: HTMLCanvasElement,
  radius: number
): Promise<Blob> {
  const width = source.width
  const height = source.height
  if (radius <= 0) return canvasToBlob(source, "image/png")
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvasToBlob(source, "image/png")
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, width, height, r)
  } else {
    ctx.moveTo(r, 0)
    ctx.lineTo(width - r, 0)
    ctx.arcTo(width, 0, width, r, r)
    ctx.lineTo(width, height - r)
    ctx.arcTo(width, height, width - r, height, r)
    ctx.lineTo(r, height)
    ctx.arcTo(0, height, 0, height - r, r)
    ctx.lineTo(0, r)
    ctx.arcTo(0, 0, r, 0, r)
    ctx.closePath()
  }
  ctx.clip()
  ctx.drawImage(source, 0, 0)
  return canvasToBlob(canvas, "image/png")
}

function filterExportHidden(node: Node) {
  if (node instanceof Element) {
    if (node.getAttribute("data-export-hidden") === "true") return false
  }
  return true
}

type RasterOptions = {
  cacheBust?: boolean
  filter?: (node: Node) => boolean
}

/** Layout dimensions for HTML or SVG roots used by export sub-rasterization. */
export function exportElementLayoutSize(
  node: Element
): { width: number; height: number } | null {
  const htmlNode = node as HTMLElement
  const width = htmlNode.offsetWidth || Number(node.getAttribute("width"))
  const height = htmlNode.offsetHeight || Number(node.getAttribute("height"))
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * The `<foreignObject>` scaling contract, shared by both capture paths.
 *
 * WebKit rasterizes foreignObject content at the size the content itself claims
 * and applies neither `drawImage`'s destination rect nor the SVG's `viewBox`
 * transform to the result. Both are how you would normally scale an export up,
 * and both left the whole scene at 1× in the top-left of an otherwise correctly
 * sized raster — while anything composited in 2D afterwards (the video quad,
 * whose scale is derived from the raster's width) came out oversized by exactly
 * the pixel ratio.
 *
 * So the SVG stays 1:1 with the output and the *content* is scaled by an
 * ordinary CSS transform, which every engine rasterizes correctly. The box keeps
 * its layout size so `cqw`/`cqh` and percentage geometry still resolve against
 * the dimensions the editor laid out.
 */
export function exportScaleStyle(
  renderedWidth: number,
  renderedHeight: number,
  scale: number
) {
  return {
    width: `${renderedWidth}px`,
    height: `${renderedHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "0 0",
  }
}

/**
 * Rasterize an export clone at `outputWidth`×`outputHeight`.
 *
 * Replaces html-to-image's `toCanvas`/`toBlob`/`toJpeg` — they all scale through
 * `drawImage`, which WebKit ignores here (see {@link exportScaleStyle}). The
 * `width`/`height`/`style` options make html-to-image emit an output-sized SVG
 * whose content carries the scale as a transform. A fresh canvas per call,
 * matching what those returned — callers hold frames across captures.
 */
function serializeExportSvg(
  node: HTMLElement,
  options: RasterOptions,
  renderedWidth: number,
  renderedHeight: number,
  outputWidth: number,
  outputHeight: number
): Promise<string> {
  return toSvg(node, {
    ...options,
    width: outputWidth,
    height: outputHeight,
    // Applied after html-to-image's own width/height, so this wins.
    style: exportScaleStyle(
      renderedWidth,
      renderedHeight,
      outputWidth / renderedWidth
    ),
  })
}

function loadRasterImage(svgUrl: string): Promise<HTMLImageElement> {
  // `Image.decode()` rejects on SVG-with-<foreignObject> in some Firefox
  // builds, so wait on load/error events — reliable in every engine.
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Export raster failed to load"))
    image.src = svgUrl
  })
}

function drawRasterImage(
  image: HTMLImageElement,
  outputWidth: number,
  outputHeight: number,
  backgroundColor?: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context for export")
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, outputWidth, outputHeight)
  }
  ctx.drawImage(image, 0, 0, outputWidth, outputHeight)
  return canvas
}

async function rasterizeNodeToCanvas(
  node: HTMLElement,
  options: RasterOptions,
  renderedWidth: number,
  renderedHeight: number,
  outputWidth: number,
  outputHeight: number,
  backgroundColor?: string
): Promise<HTMLCanvasElement> {
  const svgUrl = await serializeExportSvg(
    node,
    options,
    renderedWidth,
    renderedHeight,
    outputWidth,
    outputHeight
  )
  const image = await loadRasterImage(svgUrl)
  return drawRasterImage(image, outputWidth, outputHeight, backgroundColor)
}

/**
 * Replace each ASCII glyph tree in an animation clone with one transparent,
 * output-resolution PNG. The outer ASCII layer stays in the DOM so its plate,
 * filter, user opacity, and timeline crossfade keep their original geometry.
 */
async function flattenAnimationAsciiLayers(
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
      const raster = await rasterizeNodeToCanvas(
        glyphTree,
        { cacheBust: false },
        width,
        height,
        Math.max(1, Math.round(width * pixelRatio)),
        Math.max(1, Math.round(height * pixelRatio))
      )
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

/** Mean alpha (0–255) below which a raster is treated as a failed capture. */
const EMPTY_RASTER_ALPHA = 4

/**
 * True when a raster is transparent enough that nothing of the composition can
 * have painted. WebKit's dropped-subresource failure leaves only the DOM-drawn
 * chrome (the watermark) behind, so a plain "all pixels transparent" test is not
 * enough — sample the whole frame and look at how much of it is covered.
 */
export function isRasterEssentiallyEmpty(canvas: HTMLCanvasElement): boolean {
  const size = 32
  const probe = document.createElement("canvas")
  probe.width = size
  probe.height = size
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(canvas, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  let alpha = 0
  for (let i = 3; i < data.length; i += 4) alpha += data[i]
  return alpha / (size * size) < EMPTY_RASTER_ALPHA
}

/** Downsampled RGBA fingerprint, small enough to diff two rasters cheaply. */
const RASTER_SIGNATURE_SIZE = 32
/** Per-channel mean difference under which two rasters count as the same image. */
const SETTLED_SIGNATURE_DELTA = 1.5
const SETTLE_MAX_ATTEMPTS = 8
/**
 * Retry budget for the glass frost underlays. One runs per pane, and every
 * pixel of the result is read back through an 18px blur at 960px, so they do
 * not need the full budget the exported raster gets — without a lower cap a
 * four-pane frame could spend five settle loops on one export.
 */
const UNDERLAY_SETTLE_MAX_ATTEMPTS = 4

function rasterSignature(source: CanvasImageSource): Uint8ClampedArray | null {
  const size = RASTER_SIGNATURE_SIZE
  const probe = document.createElement("canvas")
  probe.width = size
  probe.height = size
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size).data
}

export function rasterSignatureDelta(
  a: Uint8ClampedArray | null,
  b: Uint8ClampedArray | null
): number {
  if (!a || !b || a.length !== b.length) return 255
  let total = 0
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
  return total / a.length
}

/**
 * How much of a composition a signature says painted: the opaque fraction plus
 * the colour variety, both normalised. WebKit drops the largest data-URI
 * subresources first, so a raster missing the screenshot reads as flatter and
 * (over a transparent background) less covered than the complete one.
 */
export function signatureCoverage(signature: Uint8ClampedArray | null): number {
  if (!signature) return -1
  const colors = new Set<number>()
  let opaque = 0
  for (let i = 0; i < signature.length; i += 4) {
    if (signature[i + 3] > 250) opaque++
    colors.add(
      (signature[i] << 16) | (signature[i + 1] << 8) | signature[i + 2]
    )
  }
  const pixels = signature.length / 4
  return opaque / pixels + colors.size / pixels
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** Consecutive unchanged, no-better rasters before a plateau is trusted. */
const SETTLE_CONFIRM_ATTEMPTS = 2

export type SettleProgress = {
  bestCoverage: number
  /** Coverage has risen at least once, i.e. decodes were still landing. */
  improved: boolean
  confirmations: number
}

export const INITIAL_SETTLE_PROGRESS: SettleProgress = {
  bestCoverage: -1,
  improved: false,
  confirmations: 0,
}

/**
 * Decide what one sampled raster means: whether to keep it as the best so far,
 * and whether the sequence has settled.
 *
 * A raster that merely repeats is not evidence of anything — WebKit reproduces
 * an incomplete capture exactly, and three identical rasters missing the
 * screenshot is a shape this bug actually takes. What is evidence is coverage
 * having *risen* at some point: that means subresource decodes were landing,
 * so a plateau after it is the engine finishing rather than the engine not
 * having started. Until that happens the loop keeps sampling and simply keeps
 * the best it has seen.
 */
export function advanceSettle(
  progress: SettleProgress,
  sample: { coverage: number; unchanged: boolean }
): SettleProgress & { take: boolean; done: boolean } {
  if (sample.coverage > progress.bestCoverage) {
    return {
      bestCoverage: sample.coverage,
      // The first sample sets the baseline; it has improved on nothing.
      improved: progress.bestCoverage >= 0,
      confirmations: 0,
      take: true,
      done: false,
    }
  }

  const confirmations =
    sample.unchanged && progress.improved ? progress.confirmations + 1 : 0
  return {
    ...progress,
    confirmations,
    take: false,
    done: confirmations >= SETTLE_CONFIRM_ATTEMPTS,
  }
}

/**
 * Backoff before settle attempt `attempt`.
 *
 * The early waits stay short because a capture normally completes by the third
 * attempt, and the export is blocking a click. The tail grows steeply because
 * the only thing that fixes a still-incomplete raster is giving the decodes
 * more time — a flat schedule gave a slow one (an 8K export of a large
 * screenshot) the same two thirds of a second as a trivial canvas.
 */
export function settleDelayMs(attempt: number): number {
  return Math.min(400, 20 * 2 ** (attempt - 2))
}

/**
 * Rasterize the export SVG repeatedly and answer with the best canvas sampled —
 * never a fresh draw of it.
 *
 * WebKit paints an SVG image's `<foreignObject>` with whatever data-URI
 * subresources have decoded at that instant, and every `drawImage` of that
 * image re-rasterizes it, racing the decode again. The result oscillates: a
 * canvas can come back complete, then the very next draw of the same
 * `HTMLImageElement` drops the screenshot, the background, or both. The size
 * of the destination rect makes no difference — only which decodes happen to
 * have landed. The largest image loses most often, which is why Safari exported
 * this canvas as bare glass panes over a gradient, watermark logo and all.
 *
 * So the sampled pixels have to be *kept*: each attempt draws into its own
 * output canvas, and the one handed back is a canvas that was scored, not a
 * redraw of the image that produced it. {@link advanceSettle} owns when to stop.
 *
 * Running the budget out is not a failure signal: it is also what happens when
 * the very first raster was already complete, since nothing improves on it.
 * There is no oracle for "complete" — coverage ranks two rasters of the same
 * scene, it cannot judge one alone — so exhaustion returns the best sample
 * rather than throwing, and the defence against a genuinely stuck decode is the
 * length of the window (see {@link settleDelayMs}), not a verdict at the end.
 */
async function settleRasterCanvas(
  svgUrl: string,
  outputWidth: number,
  outputHeight: number,
  backgroundColor: string | undefined,
  maxAttempts: number
): Promise<HTMLCanvasElement | null> {
  let best: HTMLCanvasElement | null = null
  let progress = INITIAL_SETTLE_PROGRESS
  let previous: Uint8ClampedArray | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, settleDelayMs(attempt))
      )
    }
    let image: HTMLImageElement
    try {
      image = await loadRasterImage(svgUrl)
    } catch {
      continue
    }

    const canvas = drawRasterImage(
      image,
      outputWidth,
      outputHeight,
      backgroundColor
    )
    const signature = rasterSignature(canvas)
    const unchanged =
      previous !== null &&
      rasterSignatureDelta(signature, previous) <= SETTLED_SIGNATURE_DELTA
    previous = signature

    const next = advanceSettle(progress, {
      coverage: signatureCoverage(signature),
      // A raster with nothing painted in it is never the answer, however
      // faithfully the engine keeps reproducing it — refuse to confirm one and
      // spend the rest of the budget waiting for the decodes.
      unchanged: unchanged && !isRasterEssentiallyEmpty(canvas),
    })
    progress = {
      bestCoverage: next.bestCoverage,
      improved: next.improved,
      confirmations: next.confirmations,
    }

    if (next.take) {
      if (best) releaseCanvas(best)
      best = canvas
    } else {
      releaseCanvas(canvas)
    }
    if (next.done) return best
  }

  return best
}

/**
 * {@link rasterizeNodeToCanvas}, but on WebKit the output canvas is settled
 * first (see {@link settleRasterCanvas}) and returned as-is.
 */
async function rasterizeExportNode(
  node: HTMLElement,
  options: RasterOptions,
  renderedWidth: number,
  renderedHeight: number,
  outputWidth: number,
  outputHeight: number,
  backgroundColor?: string,
  settleAttempts = SETTLE_MAX_ATTEMPTS
): Promise<HTMLCanvasElement> {
  const svgUrl = await serializeExportSvg(
    node,
    options,
    renderedWidth,
    renderedHeight,
    outputWidth,
    outputHeight
  )

  if (supportsObjectViewBox()) {
    const image = await loadRasterImage(svgUrl)
    const canvas = drawRasterImage(
      image,
      outputWidth,
      outputHeight,
      backgroundColor
    )
    return canvas
  }

  const settled = await settleRasterCanvas(
    svgUrl,
    outputWidth,
    outputHeight,
    backgroundColor,
    settleAttempts
  )
  // Every attempt failed to load; let the caller see the load error.
  if (!settled) {
    const image = await loadRasterImage(svgUrl)
    return drawRasterImage(image, outputWidth, outputHeight, backgroundColor)
  }
  return settled
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error(`Could not encode ${type}`)),
      type,
      quality
    )
  })
}

export async function exportCanvas(
  canvasId: string,
  format: ExportFormat,
  resolution: ExportResolution,
  options: ExportCaptureOptions = { watermark: true }
): Promise<string> {
  // ASCII backdrops paint their glyphs from an async sample of the background,
  // and the export clone below is a snapshot React never renders into again —
  // so this must happen BEFORE prepareExportNode, not before the rasterize.
  await waitForAsciiBackdrops()
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const layoutDims = getCanvasLayoutDims(node)
  if (!layoutDims) throw new Error("Canvas has zero width")
  const { width: renderedWidth, height: renderedHeight } = layoutDims

  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const pixelRatio = targetWidth / renderedWidth
  const outputWidth = Math.round(renderedWidth * pixelRatio)
  const outputHeight = Math.round(renderedHeight * pixelRatio)
  const borderRadius = getNodeBorderRadius(node)

  const exportTarget = prepareExportNode(
    node,
    renderedWidth,
    renderedHeight,
    options
  )
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)
  const assetUrls = options.watermark
    ? [...preloadUrls, WATERMARK_LOGO_SRC]
    : preloadUrls

  // No pixelRatio — rasterizeNodeToCanvas owns the scale (see exportScaleStyle).
  const baseOptions = {
    cacheBust: false,
    filter: filterExportHidden,
  } as const

  const filename = buildExportFilename({
    format: await getExportFilenameFormat(),
    scale: resolution,
    template: getExportTemplateLabel(canvasId),
    width: outputWidth,
    height: outputHeight,
    extension: EXPORT_FORMAT_EXTENSION[format],
  })

  try {
    await waitForExportAssets(assetUrls)
    await embedCloneImages(exportTarget.node)
    await bakeGlassFrost(exportTarget.node, renderedWidth, renderedHeight)
    if (format === "png") {
      const canvas = await rasterizeExportNode(
        exportTarget.node,
        baseOptions,
        renderedWidth,
        renderedHeight,
        outputWidth,
        outputHeight
      )
      const clipped = await clipCanvasToRoundedRect(
        canvas,
        borderRadius * pixelRatio
      )
      const url = URL.createObjectURL(clipped)
      try {
        triggerDownload(url, filename)
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
      return filename
    }
    if (format === "jpeg") {
      const canvas = await rasterizeExportNode(
        exportTarget.node,
        baseOptions,
        renderedWidth,
        renderedHeight,
        outputWidth,
        outputHeight,
        "#ffffff"
      )
      const url = canvas.toDataURL("image/jpeg", 0.95)
      triggerDownload(url, filename)
      return filename
    }
    const canvas = await rasterizeExportNode(
      exportTarget.node,
      baseOptions,
      renderedWidth,
      renderedHeight,
      outputWidth,
      outputHeight
    )
    const webpBlob = await canvasToBlob(canvas, "image/webp", 0.95)
    const objectUrl = URL.createObjectURL(webpBlob)
    try {
      triggerDownload(objectUrl, filename)
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    }
    return filename
  } finally {
    for (const rewrite of rewrites.reverse()) {
      rewrite.restore()
    }
    exportTarget.cleanup()
  }
}

export async function copyCanvasAsPng(
  canvasId: string,
  resolution: CopyResolution = "1080p",
  options: ExportCaptureOptions = { watermark: true }
): Promise<void> {
  if (!navigator?.clipboard?.write) {
    throw new Error("Clipboard write is not supported")
  }

  const blob = await captureCanvasAsPngBlob(
    canvasId,
    COPY_RESOLUTION_WIDTHS[resolution],
    options
  )

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ])
}

/**
 * Copy the canvas to clipboard as PNG.
 *
 * The browser Clipboard API only accepts `"image/png"` as the ClipboardItem
 * MIME key — passing any other MIME type (jpeg, webp) throws a NotAllowedError.
 * Regardless of which `format` is passed, we always write a PNG blob so the
 * write never fails. The `format` parameter is kept for API compatibility.
 */
export async function copyCanvasAsFormat(
  canvasId: string,
  _format: ExportFormat,
  resolution: CopyResolution = "1080p",
  options: ExportCaptureOptions = { watermark: true }
): Promise<void> {
  if (!navigator?.clipboard?.write) {
    throw new Error("Clipboard write is not supported")
  }

  // Always copy as PNG — it's the only format universally supported by the
  // Clipboard API across Chrome, Firefox, and Safari.
  const pngBlob = await captureCanvasAsPngBlob(
    canvasId,
    COPY_RESOLUTION_WIDTHS[resolution],
    options
  )

  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })])
}

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

export async function captureCanvasAsPngBlob(
  canvasId: string,
  targetWidth = SHARE_RESOLUTION_WIDTH,
  options: ExportCaptureOptions = {}
): Promise<Blob> {
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

  const exportTarget = prepareExportNode(
    node,
    renderedWidth,
    renderedHeight,
    options
  )
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)
  const assetUrls = options.watermark
    ? [...preloadUrls, WATERMARK_LOGO_SRC]
    : preloadUrls

  try {
    await waitForExportAssets(assetUrls)
    await embedCloneImages(exportTarget.node)
    replaceCloneVideosWithFrames(node, exportTarget.node)
    await bakeGlassFrost(exportTarget.node, renderedWidth, renderedHeight)

    // html-to-image is flaky on the first call (fonts/images not yet embedded
    // in the cloned document). Two attempts is the standard workaround.
    const captureOptions = {
      cacheBust: false,
      filter: filterExportHidden,
    } as const

    let blob: Blob | null = null
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const canvas = await rasterizeExportNode(
          exportTarget.node,
          captureOptions,
          renderedWidth,
          renderedHeight,
          Math.round(renderedWidth * pixelRatio),
          Math.round(renderedHeight * pixelRatio)
        )
        blob = await canvasToBlob(canvas, "image/png")
        if (blob) break
      } catch (raw) {
        lastError = raw
      }
    }
    if (!blob) {
      const msg =
        lastError instanceof Error
          ? lastError.message
          : lastError instanceof DOMException
            ? lastError.message
            : typeof lastError === "string"
              ? lastError
              : "Canvas capture failed — try again"
      throw new Error(msg)
    }
    return blob
  } finally {
    for (const rewrite of rewrites.reverse()) {
      rewrite.restore()
    }
    exportTarget.cleanup()
  }
}

// 4 MB — conservative limit that works on all hosting platforms
const CLIENT_MAX_SHARE_BYTES = 4 * 1024 * 1024

async function compressBlobAsJpeg(
  pngBlob: Blob,
  maxBytes: number
): Promise<Blob> {
  const bitmap = await createImageBitmap(pngBlob)
  const offscreen = document.createElement("canvas")
  offscreen.width = bitmap.width
  offscreen.height = bitmap.height
  const ctx = offscreen.getContext("2d")
  if (!ctx) throw new Error("Could not get 2d context")
  ctx.drawImage(bitmap, 0, 0)

  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    const jpeg = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", quality)
    )
    if (jpeg && jpeg.size <= maxBytes) return jpeg
  }

  throw new Error(
    "Image is too large to share. Try simplifying the canvas or reducing its size."
  )
}

export async function captureCanvasForShare(
  canvasId: string,
  options: ExportCaptureOptions = { watermark: true }
): Promise<{ blob: Blob; contentType: string }> {
  const pngBlob = await captureCanvasAsPngBlob(
    canvasId,
    SHARE_RESOLUTION_WIDTH,
    options
  )

  if (pngBlob.size <= CLIENT_MAX_SHARE_BYTES) {
    return { blob: pngBlob, contentType: "image/png" }
  }

  const jpegBlob = await compressBlobAsJpeg(pngBlob, CLIENT_MAX_SHARE_BYTES)
  return { blob: jpegBlob, contentType: "image/jpeg" }
}

/**
 * Small JPEG thumbnail used by the saved-drafts grid. Renders at 480px wide
 * (enough for sharp retina rendering at typical card sizes) and re-encodes
 * as JPEG quality 0.8 to keep the payload well under the per-request body
 * limit. Returns null if capture fails so the caller can still finish the
 * save without a preview.
 */
export async function captureCanvasThumbnail(
  canvasId: string,
  targetWidth = 480
): Promise<Blob | null> {
  try {
    const pngBlob = await captureCanvasAsPngBlob(canvasId, targetWidth)
    const bitmap = await createImageBitmap(pngBlob)
    const offscreen = document.createElement("canvas")
    offscreen.width = bitmap.width
    offscreen.height = bitmap.height
    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, offscreen.width, offscreen.height)
    ctx.drawImage(bitmap, 0, 0)
    return await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", 0.8)
    )
  } catch (err) {
    console.warn("Could not capture draft thumbnail", err)
    return null
  }
}

export async function createImageThumbnailBlob(
  source: string,
  targetWidth = 480
): Promise<Blob | null> {
  if (!source) return null

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Could not load thumbnail source"))
      if (shouldProxyAssetUrl(source)) {
        img.crossOrigin = "anonymous"
        img.src = proxiedAssetUrl(source)
      } else {
        img.src = source
      }
    })

    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    if (!sourceWidth || !sourceHeight) return null

    const width = Math.min(targetWidth, sourceWidth)
    const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width))
    const offscreen = document.createElement("canvas")
    offscreen.width = width
    offscreen.height = height

    const ctx = offscreen.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob(resolve, "image/jpeg", 0.8)
    )
  } catch (err) {
    console.warn("Could not create image thumbnail", err)
    return null
  }
}
