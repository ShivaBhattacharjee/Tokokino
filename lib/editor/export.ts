import { toJpeg, toBlob } from "html-to-image"

import { shouldProxyAssetUrl } from "./export-assets"
import { buildExportFilename, getExportFilenameFormat } from "./export-filename"
import { useEditorStore } from "./store"

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

/** Resolve a `{TEMPLATE}` label from the active preset / aspect ratio. */
function getTemplateLabel(canvasId: string): string {
  try {
    const state = useEditorStore.getState()
    if (state.activeCustomPresetId) {
      const preset = state.customPresets.find(
        (p) => p.id === state.activeCustomPresetId
      )
      if (preset?.name) return preset.name
    }
    const presetId =
      state.activeSinglePresetId ?? state.activeLayoutPresetId ?? null
    if (presetId) return presetId
    const canvas = state.present.canvases.find((c) => c.id === canvasId)
    const aspect = canvas?.aspect ?? state.present.aspect
    if (aspect?.w && aspect?.h) return `${aspect.w}x${aspect.h}`
  } catch {
    /* store not ready — fall through */
  }
  return "default"
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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

function makeExportStyle(scopeId: string) {
  const exportStyle = document.createElement("style")
  exportStyle.id = "__export-override"
  const scope = `[data-export-scope="${scopeId}"]`
  exportStyle.textContent = `
    ${scope}, ${scope} * {
      outline: none !important;
      caret-color: transparent !important;
      --tw-ring-shadow: 0 0 #0000 !important;
      --tw-ring-offset-shadow: 0 0 #0000 !important;
      animation: none !important;
      transition: none !important;
    }
    ${scope} [data-export-hidden="true"] { display: none !important; }
    ${scope} [data-selection-border="true"] { border: none !important; }
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

function prepareExportNode(
  source: HTMLElement,
  width: number,
  height: number,
  options: ExportCaptureOptions = {}
) {
  const wrapper = document.createElement("div")
  const node = source.cloneNode(true) as HTMLElement
  const scopeId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const exportStyle = makeExportStyle(scopeId)

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

  document.head.appendChild(exportStyle)
  if (options.watermark) {
    appendWatermark(node, width, height)
  }
  wrapper.appendChild(node)
  document.body.appendChild(wrapper)

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

async function clipBlobToRoundedRect(
  blob: Blob,
  width: number,
  height: number,
  radius: number
): Promise<Blob> {
  if (radius <= 0) return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return blob
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
  ctx.drawImage(bitmap, 0, 0)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("clip failed"))),
      "image/png"
    )
  })
}

function filterExportHidden(node: Node) {
  if (node instanceof Element) {
    if (node.getAttribute("data-export-hidden") === "true") return false
  }
  return true
}

export async function exportCanvas(
  canvasId: string,
  format: ExportFormat,
  resolution: ExportResolution,
  options: ExportCaptureOptions = { watermark: true }
): Promise<string> {
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

  const baseOptions = {
    pixelRatio,
    cacheBust: false,
    filter: filterExportHidden,
  } as const

  const filename = buildExportFilename({
    format: await getExportFilenameFormat(),
    scale: resolution,
    template: getTemplateLabel(canvasId),
    width: outputWidth,
    height: outputHeight,
    extension: EXPORT_FORMAT_EXTENSION[format],
  })

  try {
    await waitForExportAssets(assetUrls)
    await embedCloneImages(exportTarget.node)

    if (format === "png") {
      const rawBlob = await toBlob(exportTarget.node, baseOptions)
      if (!rawBlob) throw new Error("Could not capture canvas")
      const clipped = await clipBlobToRoundedRect(
        rawBlob,
        outputWidth,
        outputHeight,
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
      const url = await toJpeg(exportTarget.node, {
        ...baseOptions,
        backgroundColor: "#ffffff",
        quality: 0.95,
      })
      triggerDownload(url, filename)
      return filename
    }
    // webp — html-to-image doesn't have a direct toWebp, so render to canvas via toBlob (PNG) and re-encode
    const pngBlob = await toBlob(exportTarget.node, baseOptions)
    if (!pngBlob) throw new Error("Could not capture canvas")
    const bitmap = await createImageBitmap(pngBlob)
    const offscreen = document.createElement("canvas")
    offscreen.width = bitmap.width
    offscreen.height = bitmap.height
    const ctx = offscreen.getContext("2d")
    if (!ctx) throw new Error("Could not get 2d context")
    ctx.drawImage(bitmap, 0, 0)
    const webpBlob: Blob | null = await new Promise((resolve) =>
      offscreen.toBlob(resolve, "image/webp", 0.95)
    )
    if (!webpBlob) throw new Error("Could not encode WebP")
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

export async function captureCanvasAsPngBlob(
  canvasId: string,
  targetWidth = SHARE_RESOLUTION_WIDTH,
  options: ExportCaptureOptions = {}
): Promise<Blob> {
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

    // html-to-image is flaky on the first call (fonts/images not yet embedded
    // in the cloned document). Two attempts is the standard workaround.
    const captureOptions = {
      pixelRatio,
      cacheBust: false,
      filter: filterExportHidden,
    } as const

    let blob: Blob | null = null
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        blob = await toBlob(exportTarget.node, captureOptions)
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
