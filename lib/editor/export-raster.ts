import { toSvg } from "html-to-image"

export type RasterOptions = {
  cacheBust?: boolean
  filter?: (node: Node) => boolean
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
export function serializeExportSvg(
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

export function loadRasterImage(svgUrl: string): Promise<HTMLImageElement> {
  // `Image.decode()` rejects on SVG-with-<foreignObject> in some Firefox
  // builds, so wait on load/error events — reliable in every engine.
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Export raster failed to load"))
    image.src = svgUrl
  })
}

export function drawRasterImage(
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

export async function rasterizeNodeToCanvas(
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

export function canvasToBlob(
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

export async function clipCanvasToRoundedRect(
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
