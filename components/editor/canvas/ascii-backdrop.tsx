"use client"

import * as React from "react"

import {
  ASCII_FONT_FAMILY,
  asciiGridSize,
  asciiPlateColor,
  asciiResolutionPreviewTransform,
  asciiRunGeometry,
  gridFromImageData,
  monospaceAdvanceRatio,
  sampleBackgroundPixels,
  type AsciiGrid,
} from "@/lib/editor/ascii-backdrop"
import type { BackdropAscii, Background } from "@/lib/editor/state-types"

type Segment = { text: string; color: string; start: number }

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Merge neighbouring cells that quantized to the same colour so a coloured grid
 * renders as a few hundred spans instead of one per character.
 */
function rowSegments(grid: AsciiGrid, row: number): Segment[] {
  const segments: Segment[] = []
  const start = row * grid.cols
  for (let i = 0; i < grid.cols; i++) {
    const color = grid.colors[start + i]
    const char = grid.chars[start + i]
    const last = segments[segments.length - 1]
    if (last && last.color === color) last.text += char
    else segments.push({ text: char, color, start: i })
  }
  return segments
}

/**
 * Package the glyph tree as one SVG image resource. Keeping the thousands of
 * coloured text runs out of the live DOM lets WebKit cache/composite the layer
 * as a replaced image while the screenshot moves, without sacrificing vector
 * text when html-to-image captures a high-resolution export.
 */
function asciiSvgDataUrl({
  grid,
  width,
  height,
  cellWidth,
  cellHeight,
  fontSize,
  ascii,
}: {
  grid: AsciiGrid
  width: number
  height: number
  cellWidth: number
  cellHeight: number
  fontSize: number
  ascii: BackdropAscii
}): string | null {
  if (!(width > 0) || !(height > 0) || !(fontSize > 0)) return null

  const runs: string[] = []
  for (let row = 0; row < grid.rows; row++) {
    const y = (row + 0.5) * cellHeight
    if (!ascii.colored) {
      const text = grid.chars.slice(row * grid.cols, (row + 1) * grid.cols)
      const geometry = asciiRunGeometry(0, text.length, cellWidth)
      runs.push(
        `<text x="${geometry.x}" y="${y}" textLength="${geometry.width}" lengthAdjust="spacingAndGlyphs" dominant-baseline="central" fill="${escapeSvg(ascii.color)}" xml:space="preserve">${escapeSvg(text)}</text>`
      )
      continue
    }

    for (const segment of rowSegments(grid, row)) {
      const geometry = asciiRunGeometry(
        segment.start,
        segment.text.length,
        cellWidth
      )
      runs.push(
        `<text x="${geometry.x}" y="${y}" textLength="${geometry.width}" lengthAdjust="spacingAndGlyphs" dominant-baseline="central" fill="${escapeSvg(segment.color)}" xml:space="preserve">${escapeSvg(segment.text)}</text>`
      )
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" ` +
    `font-family="${escapeSvg(ASCII_FONT_FAMILY)}" font-size="${fontSize}" style="font-variant-ligatures:none;overflow:hidden">${runs.join("")}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Renders the canvas background as ASCII characters.
 *
 * The glyphs live in an SVG-backed image rather than a `<canvas>` because export
 * rasterizes the DOM at up to 8K — a canvas would be captured at its own
 * (screen-sized) resolution and upscaled into mush, while the SVG re-renders
 * sharply at any pixel ratio without thousands of live DOM nodes.
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
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  // Keep the last successful sample so a resolution commit (or a live-preview
  // scale) can stay on screen until the next resample lands — swapping to
  // `null` mid-drag is what made the backdrop blink.
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
    ascii.resolution,
    size.width,
    size.height
  )

  React.useEffect(() => {
    if (rows < 1) return
    let cancelled = false
    sampleBackgroundPixels(background, cols, rows)
      .then((data) => {
        if (!cancelled && data) setSample({ pixels: data, cols, rows })
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
      colored: ascii.colored,
    })
  }, [ascii.charset, ascii.colored, ascii.inverted, sample])

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
  const glyphImageUrl = React.useMemo(() => {
    if (!grid) return null
    return asciiSvgDataUrl({
      grid,
      width: size.width,
      height: size.height,
      cellWidth,
      cellHeight,
      fontSize,
      ascii,
    })
  }, [ascii, cellHeight, cellWidth, fontSize, grid, size.height, size.width])

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
          filter: `${filter ?? "brightness(1)"} opacity(${committedOpacity})`,
        }}
      >
        {glyphImageUrl ? (
          <img
            aria-hidden
            data-export-ascii-glyphs="true"
            src={glyphImageUrl}
            alt=""
            draggable={false}
            width={size.width}
            height={size.height}
            style={{
              display: "block",
              width: size.width,
              height: size.height,
              maxWidth: "none",
              overflow: "hidden",
              transform: asciiResolutionPreviewTransform(
                displayCols,
                ascii.resolution
              ),
              transformOrigin: "0 0",
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export const AsciiBackdrop = React.memo(AsciiBackdropImpl)
