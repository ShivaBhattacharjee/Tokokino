import { triggerAnchorDownload } from "@/lib/download"

import { waitForAsciiBackdrops } from "./ascii-backdrop"
import {
  rewriteExportAssets,
  waitForExportAssets,
} from "./export-asset-rewrite"
import {
  measureExportWatermarkLogo,
  prepareExportNode,
  type ExportWatermarkLogoPlacement,
} from "./export-clone"
import {
  COPY_RESOLUTION_WIDTHS,
  EXPORT_FORMAT_EXTENSION,
  EXPORT_RESOLUTION_WIDTHS,
  SHARE_RESOLUTION_WIDTH,
  type CopyResolution,
  type ExportCaptureOptions,
  type ExportFormat,
  type ExportResolution,
} from "./export-constants"
import {
  filterExportHidden,
  findCanvasElement,
  getCanvasLayoutDims,
  getNodeBorderRadius,
} from "./export-dom"
import { embedCloneImages, warmEmbeddedImageDecodes } from "./export-embed"
import {
  buildExportFilename,
  getExportFilenameFormat,
  getExportTemplateLabel,
} from "./export-filename"
import { bakeGlassFrost } from "./export-glass"
import { canvasToBlob, clipCanvasToRoundedRect } from "./export-raster"
import { rasterizeExportNode } from "./export-settle"
import { replaceCloneVideosWithFrames } from "./export-video-frames"
import { loadWatermarkLogo } from "./animation-export/watermark"

function triggerDownload(url: string, filename: string) {
  triggerAnchorDownload(url, filename)
}

/**
 * Paint the logo after the DOM clone has been rasterized. Safari can omit an
 * image nested in the foreignObject while leaving its flex box and surrounding
 * text intact; drawing onto the returned canvas removes that decode race.
 */
function paintExportWatermarkLogo(
  canvas: HTMLCanvasElement,
  placement: ExportWatermarkLogoPlacement | null,
  renderedWidth: number,
  renderedHeight: number,
  logo: HTMLImageElement | null
): void {
  if (!placement || !logo || renderedWidth <= 0 || renderedHeight <= 0) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const scaleX = canvas.width / renderedWidth
  const scaleY = canvas.height / renderedHeight
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)"
  ctx.shadowBlur = Math.max(scaleX, scaleY)
  ctx.shadowOffsetY = scaleY
  ctx.drawImage(
    logo,
    placement.x * scaleX,
    placement.y * scaleY,
    placement.width * scaleX,
    placement.height * scaleY
  )
  ctx.restore()
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
  const watermarkLogoPromise = options.watermark
    ? loadWatermarkLogo()
    : Promise.resolve(null)

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
    await waitForExportAssets(preloadUrls)
    await embedCloneImages(exportTarget.node)
    await bakeGlassFrost(exportTarget.node, renderedWidth, renderedHeight)
    // After the frost, so its textures are warmed with everything else.
    await warmEmbeddedImageDecodes(exportTarget.node)
    const watermarkLogo = await watermarkLogoPromise
    const watermarkPlacement = options.watermark
      ? measureExportWatermarkLogo(exportTarget.node)
      : null
    if (format === "png") {
      const canvas = await rasterizeExportNode(
        exportTarget.node,
        baseOptions,
        renderedWidth,
        renderedHeight,
        outputWidth,
        outputHeight
      )
      paintExportWatermarkLogo(
        canvas,
        watermarkPlacement,
        renderedWidth,
        renderedHeight,
        watermarkLogo
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
      paintExportWatermarkLogo(
        canvas,
        watermarkPlacement,
        renderedWidth,
        renderedHeight,
        watermarkLogo
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
    paintExportWatermarkLogo(
      canvas,
      watermarkPlacement,
      renderedWidth,
      renderedHeight,
      watermarkLogo
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
  const watermarkLogoPromise = options.watermark
    ? loadWatermarkLogo()
    : Promise.resolve(null)

  try {
    await waitForExportAssets(preloadUrls)
    await embedCloneImages(exportTarget.node)
    replaceCloneVideosWithFrames(node, exportTarget.node)
    await bakeGlassFrost(exportTarget.node, renderedWidth, renderedHeight)
    // After the frost, so its textures are warmed with everything else.
    await warmEmbeddedImageDecodes(exportTarget.node)
    const watermarkLogo = await watermarkLogoPromise
    const watermarkPlacement = options.watermark
      ? measureExportWatermarkLogo(exportTarget.node)
      : null

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
        paintExportWatermarkLogo(
          canvas,
          watermarkPlacement,
          renderedWidth,
          renderedHeight,
          watermarkLogo
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
