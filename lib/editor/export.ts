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

function findCanvasElement(canvasId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-canvas-id="${canvasId}"]`
  )
}

export function getCanvasRenderedDims(canvasId: string): {
  width: number
  height: number
} | null {
  const node = findCanvasElement(canvasId)
  if (!node) return null
  const rect = node.getBoundingClientRect()
  const width = rect.width || node.offsetWidth
  const height = rect.height || node.offsetHeight
  if (!width || !height) return null
  return { width, height }
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
      return `url(${quote || "\""}${proxied}${quote || "\""})`
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

function makeExportStyle() {
  const exportStyle = document.createElement("style")
  exportStyle.id = "__export-override"
  exportStyle.textContent = `
    * {
      outline: none !important;
      caret-color: transparent !important;
      --tw-ring-shadow: 0 0 #0000 !important;
      --tw-ring-offset-shadow: 0 0 #0000 !important;
    }
    [data-export-hidden="true"] { display: none !important; }
    [data-selection-border="true"] { border: none !important; }
  `
  return exportStyle
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

  const rect = node.getBoundingClientRect()
  const renderedWidth = rect.width || node.offsetWidth
  if (!renderedWidth) throw new Error("Canvas has zero width")

  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const pixelRatio = targetWidth / renderedWidth

  const exportStyle = makeExportStyle()
  document.head.appendChild(exportStyle)
  const { rewrites, preloadUrls } = rewriteExportAssets(node)

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
      const url = await toPng(node, baseOptions)
      triggerDownload(url, filename)
      return filename
    }
    if (format === "jpeg") {
      const url = await toJpeg(node, {
        ...baseOptions,
        backgroundColor: "#ffffff",
        quality: 0.95,
      })
      triggerDownload(url, filename)
      return filename
    }
    // webp — html-to-image doesn't have a direct toWebp, so render to canvas via toBlob (PNG) and re-encode
    const pngBlob = await toBlob(node, baseOptions)
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
    exportStyle.remove()
  }
}

export async function copyCanvasAsPng(
  canvasId: string,
  resolution: CopyResolution = "1080p"
): Promise<void> {
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")
  if (!navigator?.clipboard?.write) {
    throw new Error("Clipboard write is not supported")
  }

  const rect = node.getBoundingClientRect()
  const renderedWidth = rect.width || node.offsetWidth
  if (!renderedWidth) throw new Error("Canvas has zero width")

  const targetWidth = COPY_RESOLUTION_WIDTHS[resolution]
  const pixelRatio = targetWidth / renderedWidth

  const exportStyle = makeExportStyle()
  document.head.appendChild(exportStyle)
  const { rewrites, preloadUrls } = rewriteExportAssets(node)

  try {
    await waitForExportAssets(preloadUrls)

    const blob = await toBlob(node, {
      pixelRatio,
      cacheBust: true,
      filter: filterExportHidden,
    })
    if (!blob) throw new Error("Could not capture canvas")

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ])
  } finally {
    for (const rewrite of rewrites.reverse()) {
      rewrite.restore()
    }
    exportStyle.remove()
  }
}
