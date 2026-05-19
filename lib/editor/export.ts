import { toPng, toJpeg, toBlob } from "html-to-image"

export type ExportFormat = "png" | "jpeg" | "webp"
export type ExportResolution = "hd" | "4k" | "8k"
export type CopyResolution = "1080p"

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

function shouldProxyAssetUrl(value: string) {
  const trimmed = value.trim()
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return false
  }

  try {
    const url = new URL(trimmed, window.location.href)
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin !== window.location.origin
    )
  } catch {
    return false
  }
}

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
          image.crossOrigin = "anonymous"
          image.onload = () => resolve()
          image.onerror = () => resolve()
          image.src = url
        })
    )
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

function prepareExportNode(source: HTMLElement, width: number, height: number) {
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

function filterExportHidden(node: Node) {
  if (node instanceof Element) {
    if (node.getAttribute("data-export-hidden") === "true") return false
  }
  return true
}

export async function exportCanvas(
  canvasId: string,
  format: ExportFormat,
  resolution: ExportResolution
): Promise<string> {
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const layoutDims = getCanvasLayoutDims(node)
  if (!layoutDims) throw new Error("Canvas has zero width")
  const { width: renderedWidth, height: renderedHeight } = layoutDims

  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const pixelRatio = targetWidth / renderedWidth

  const exportTarget = prepareExportNode(node, renderedWidth, renderedHeight)
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)

  const baseOptions = {
    pixelRatio,
    cacheBust: true,
    filter: filterExportHidden,
  } as const

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19)
  const filename = `screenshot_${resolution}_${ts}${EXPORT_FORMAT_EXTENSION[format]}`

  try {
    await waitForExportAssets(preloadUrls)

    if (format === "png") {
      const url = await toPng(exportTarget.node, baseOptions)
      triggerDownload(url, filename)
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
  resolution: CopyResolution = "1080p"
): Promise<void> {
  if (!navigator?.clipboard?.write) {
    throw new Error("Clipboard write is not supported")
  }

  const blob = await captureCanvasAsPngBlob(
    canvasId,
    COPY_RESOLUTION_WIDTHS[resolution]
  )

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ])
}

export async function captureCanvasAsPngBlob(
  canvasId: string,
  targetWidth = SHARE_RESOLUTION_WIDTH
): Promise<Blob> {
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const layoutDims = getCanvasLayoutDims(node)
  if (!layoutDims) throw new Error("Canvas has zero width")
  const { width: renderedWidth, height: renderedHeight } = layoutDims

  const pixelRatio = targetWidth / renderedWidth

  const exportTarget = prepareExportNode(node, renderedWidth, renderedHeight)
  const { rewrites, preloadUrls } = rewriteExportAssets(exportTarget.node)

  try {
    await waitForExportAssets(preloadUrls)

    const blob = await toBlob(exportTarget.node, {
      pixelRatio,
      cacheBust: true,
      filter: filterExportHidden,
    })
    if (!blob) throw new Error("Could not capture canvas")
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
  canvasId: string
): Promise<{ blob: Blob; contentType: string }> {
  const pngBlob = await captureCanvasAsPngBlob(canvasId, SHARE_RESOLUTION_WIDTH)

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
