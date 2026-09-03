"use client"

import * as React from "react"

import {
  ASCII_FONT_FAMILY,
  asciiGridSize,
  asciiPlateColor,
  getAsciiResolutionPreview,
  gridFromImageData,
  isWebKitEngine,
  monospaceAdvanceRatio,
  sampleBackgroundPixels,
  subscribeAsciiResolutionPreview,
  type AsciiGrid,
} from "@/lib/editor/ascii-backdrop"
import { backgroundCss } from "@/lib/editor/css-utils"
import type { BackdropAscii, Background } from "@/lib/editor/state-types"
import { useCanvasScopeId, useCanvasSourceId } from "@/lib/editor/store"

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Package only the glyph alpha as an SVG mask. Source-coloured ASCII used to
 * emit one SVG <text> per colour run; a detailed 200-column background could
 * therefore emit roughly 12,000 text nodes. The mask always has one node per
 * row and lets the original background supply the ink. Chromium can composite
 * it live; WebKit keeps it hidden until export and uses the flat canvas below.
 */
function asciiGlyphMaskUrl({
  grid,
  width,
  height,
  cellHeight,
  fontSize,
}: {
  grid: AsciiGrid
  width: number
  height: number
  cellHeight: number
  fontSize: number
}): string | null {
  if (!(width > 0) || !(height > 0) || !(fontSize > 0)) return null

  const rows: string[] = []
  for (let row = 0; row < grid.rows; row++) {
    const y = (row + 0.5) * cellHeight
    const text = grid.chars.slice(row * grid.cols, (row + 1) * grid.cols)
    rows.push(
      `<text x="0" y="${y}" textLength="${width}" lengthAdjust="spacingAndGlyphs" dominant-baseline="central" fill="white" xml:space="preserve">${escapeSvg(text)}</text>`
    )
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" ` +
    `font-family="${escapeSvg(ASCII_FONT_FAMILY)}" font-size="${fontSize}" style="font-variant-ligatures:none;overflow:hidden">${rows.join("")}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Paint a screen-resolution ASCII texture once and hand WebKit one flat canvas
 * layer to composite. Safari repeatedly re-rasterizes the equivalent CSS/SVG
 * mask while the editor moves, which becomes dramatically slower at 120 Hz.
 */
function paintAsciiRasterPreview(
  canvas: HTMLCanvasElement,
  grid: AsciiGrid,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  fontSize: number,
  ascii: BackdropAscii
): void {
  if (!(width > 0) || !(height > 0) || !(fontSize > 0)) return

  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const outputWidth = Math.max(1, Math.round(width * pixelRatio))
  const outputHeight = Math.max(1, Math.round(height * pixelRatio))
  if (canvas.width !== outputWidth) canvas.width = outputWidth
  if (canvas.height !== outputHeight) canvas.height = outputHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, outputWidth, outputHeight)
  ctx.fillStyle = "#fff"
  ctx.font = `${fontSize * pixelRatio}px ${ASCII_FONT_FAMILY}`
  ctx.textBaseline = "middle"

  const cellHeight = outputHeight / grid.rows
  for (let row = 0; row < grid.rows; row++) {
    const text = grid.chars.slice(row * grid.cols, (row + 1) * grid.cols)
    const measuredWidth = ctx.measureText(text).width
    ctx.save()
    ctx.translate(0, (row + 0.5) * cellHeight)
    if (measuredWidth > 0) ctx.scale(outputWidth / measuredWidth, 1)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  ctx.globalCompositeOperation = "source-in"
  if (ascii.colored && pixels.length >= grid.cols * grid.rows * 4) {
    const colors = document.createElement("canvas")
    colors.width = grid.cols
    colors.height = grid.rows
    const colorsCtx = colors.getContext("2d")
    if (colorsCtx) {
      const image = colorsCtx.createImageData(grid.cols, grid.rows)
      image.data.set(pixels.subarray(0, image.data.length))
      colorsCtx.putImageData(image, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(colors, 0, 0, outputWidth, outputHeight)
    }
  } else {
    ctx.fillStyle = ascii.color
    ctx.fillRect(0, 0, outputWidth, outputHeight)
  }
  ctx.globalCompositeOperation = "source-over"
}

/**
 * Renders the canvas background as ASCII characters.
 *
 * Chromium previews the vector mask directly. WebKit previews a flat canvas
 * because its live SVG-mask compositor stalls badly at high refresh rates; the
 * hidden vector layer is restored in the export clone so 8K output stays sharp.
 */
function AsciiBackdropImpl({
  background,
  ascii,
  filter,
  opacity,
}: {
  background: Background
  ascii: BackdropAscii
  filter?: string
  /**
   * Animate mode: the layer's crossfade opacity, as a `var(…, <rest>)` string.
   * Plain opacity on a plain element — no blend modes or backdrop-filter — so
   * the transition composites identically on WebKit.
   */
  opacity?: string
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const scopeId = useCanvasScopeId()
  const sourceCanvasId = useCanvasSourceId()
  const rasterRef = React.useRef<HTMLCanvasElement>(null)
  const useRasterPreview = React.useMemo(() => isWebKitEngine(), [])
  // Preset thumbnails mount under a synthetic scope id but mirror a real
  // canvas, so they read the source canvas's preview and track the drag too.
  const previewCanvasId = sourceCanvasId ?? scopeId
  const previewResolution = React.useSyncExternalStore(
    subscribeAsciiResolutionPreview,
    () => getAsciiResolutionPreview(previewCanvasId),
    () => null
  )
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  // Keep the last successful sample so the next resolution can stay off screen
  // until its resample lands — swapping to `null` mid-drag is what made the
  // backdrop blink.
  const [sample, setSample] = React.useState<{
    pixels: Uint8ClampedArray
    cols: number
    rows: number
  } | null>(null)

  React.useEffect(() => {
    const node = hostRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setSize((prev) =>
        prev.width === box.width && prev.height === box.height
          ? prev
          : { width: box.width, height: box.height }
      )
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Rows follow the canvas aspect only, so zooming the editor viewport rescales
  // the glyphs without resampling the background. The budget only bites on very
  // tall canvases, where the row count would otherwise multiply out of hand.
  const { cols, rows } = asciiGridSize(
    previewResolution ?? ascii.resolution,
    size.width,
    size.height
  )

  React.useEffect(() => {
    if (rows < 1) return
    let cancelled = false
    sampleBackgroundPixels(background, cols, rows)
      .then((data) => {
        if (!cancelled && data) {
          setSample({ pixels: data, cols, rows })
        }
      })
      .catch(() => {
        // Keep the last good sample — a failed resample must not blank the
        // backdrop while a resolution drag is still on screen.
      })
    return () => {
      cancelled = true
    }
  }, [background, cols, rows])

  const displayCols = sample?.cols ?? cols
  const displayRows = sample?.rows ?? rows

  const grid = React.useMemo(() => {
    if (!sample || sample.rows < 1) return null
    if (sample.pixels.length < sample.cols * sample.rows * 4) return null
    return gridFromImageData(sample.pixels, sample.cols, sample.rows, {
      charset: ascii.charset,
      inverted: ascii.inverted,
      // The render layer supplies source colour. Avoid allocating/quantizing
      // one CSS colour string per cell just to discard it.
      colored: false,
    })
  }, [ascii.charset, ascii.inverted, sample])

  const plate = React.useMemo(() => {
    if (!sample || sample.rows < 1) return undefined
    if (sample.pixels.length < sample.cols * sample.rows * 4) return undefined
    return asciiPlateColor(sample.pixels, sample.cols * sample.rows)
  }, [sample])

  const cellWidth = displayCols > 0 ? size.width / displayCols : 0
  const cellHeight = displayRows > 0 ? size.height / displayRows : 0
  // Size the font from the cell width so one glyph advance is exactly one cell;
  // the line box then stretches to the cell height to fill the canvas.
  const fontSize = cellWidth / monospaceAdvanceRatio()
  const userOpacity = (ascii.opacity ?? 100) / 100
  const committedOpacity = `var(--bd-ascii-opacity, ${userOpacity})`
  const glyphMaskUrl = React.useMemo(() => {
    if (!grid) return null
    return asciiGlyphMaskUrl({
      grid,
      width: size.width,
      height: size.height,
      cellHeight,
      fontSize,
    })
  }, [cellHeight, fontSize, grid, size.height, size.width])

  const glyphStyle = React.useMemo<React.CSSProperties>(() => {
    if (!glyphMaskUrl) return {}
    const ink = ascii.colored
      ? backgroundCss(background)
      : { background: ascii.color }
    const mask = `url("${glyphMaskUrl}")`
    return {
      ...ink,
      maskImage: mask,
      WebkitMaskImage: mask,
      maskPosition: "0 0",
      WebkitMaskPosition: "0 0",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskSize: "100% 100%",
      WebkitMaskSize: "100% 100%",
    }
  }, [ascii.color, ascii.colored, background, glyphMaskUrl])

  React.useEffect(() => {
    const canvas = rasterRef.current
    if (!useRasterPreview || !canvas || !grid || !sample) return
    paintAsciiRasterPreview(
      canvas,
      grid,
      sample.pixels,
      size.width,
      size.height,
      fontSize,
      ascii
    )
  }, [ascii, fontSize, grid, sample, size.height, size.width, useRasterPreview])

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        opacity: opacity as React.CSSProperties["opacity"],
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: plate,
          filter,
          opacity: committedOpacity as React.CSSProperties["opacity"],
        }}
      >
        {useRasterPreview ? (
          <canvas
            ref={rasterRef}
            aria-hidden
            data-export-hidden="true"
            className="absolute inset-0 block size-full"
          />
        ) : null}
        {glyphMaskUrl ? (
          <div
            aria-hidden
            data-export-ascii-glyphs="true"
            data-export-ascii-vector="true"
            data-bg-source-url={
              ascii.colored &&
              background.type === "image" &&
              background.sourceUrl &&
              background.sourceUrl !== background.value
                ? background.sourceUrl
                : undefined
            }
            className="absolute inset-0"
            style={{
              ...glyphStyle,
              display: useRasterPreview ? "none" : undefined,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export const AsciiBackdrop = React.memo(AsciiBackdropImpl)
