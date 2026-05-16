import { toPng, toJpeg, toBlob } from "html-to-image"

export type ExportFormat = "png" | "jpeg" | "webp"
export type ExportResolution = "hd" | "4k" | "8k"

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
  jpeg: ".jpg",
  webp: ".webp",
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

export async function exportCanvas(
  canvasId: string,
  format: ExportFormat,
  resolution: ExportResolution
): Promise<void> {
  const node = findCanvasElement(canvasId)
  if (!node) throw new Error("Canvas not found")

  const rect = node.getBoundingClientRect()
  const renderedWidth = rect.width || node.offsetWidth
  if (!renderedWidth) throw new Error("Canvas has zero width")

  const targetWidth = EXPORT_RESOLUTION_WIDTHS[resolution]
  const pixelRatio = targetWidth / renderedWidth

  const baseOptions = {
    pixelRatio,
    cacheBust: true,
  } as const

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19)
  const filename = `screenshot_${resolution}_${ts}${EXPORT_FORMAT_EXTENSION[format]}`

  if (format === "png") {
    const url = await toPng(node, baseOptions)
    triggerDownload(url, filename)
    return
  }
  if (format === "jpeg") {
    const url = await toJpeg(node, {
      ...baseOptions,
      backgroundColor: "#ffffff",
      quality: 0.95,
    })
    triggerDownload(url, filename)
    return
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
}
