"use client"

import * as React from "react"

import {
  ASCII_FONT_FAMILY,
  ASCII_MAX_RESOLUTION,
  ASCII_MIN_RESOLUTION,
  asciiPlateColor,
  asciiRowCount,
  gridFromImageData,
  monospaceAdvanceRatio,
  sampleBackgroundPixels,
  type AsciiGrid,
} from "@/lib/editor/ascii-backdrop"
import type { BackdropAscii, Background } from "@/lib/editor/state-types"
import { clampNumber } from "@/lib/editor/value-schemas"

type Segment = { text: string; color: string }

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
    else segments.push({ text: char, color })
  }
  return segments
}

/**
 * Renders the canvas background as ASCII characters.
 *
 * The glyphs are real DOM text rather than a `<canvas>` because export
 * rasterizes the DOM at up to 8K — a canvas would be captured at its own
 * (screen-sized) resolution and upscaled into mush, while text re-renders sharp
 * at any pixel ratio.
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
  const [pixels, setPixels] = React.useState<Uint8ClampedArray | null>(null)

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

  const cols = Math.round(
    clampNumber(ascii.resolution, ASCII_MIN_RESOLUTION, ASCII_MAX_RESOLUTION) ??
      ASCII_MIN_RESOLUTION
  )
  // Rows follow the canvas aspect only, so zooming the editor viewport rescales
  // the glyphs without resampling the background.
  const rows = asciiRowCount(cols, size.width, size.height)

  React.useEffect(() => {
    if (rows < 1) return
    let cancelled = false
    sampleBackgroundPixels(background, cols, rows)
      .then((data) => {
        if (!cancelled) setPixels(data)
      })
      .catch(() => {
        if (!cancelled) setPixels(null)
      })
    return () => {
      cancelled = true
    }
  }, [background, cols, rows])

  const grid = React.useMemo(() => {
    if (!pixels || rows < 1 || pixels.length < cols * rows * 4) return null
    return gridFromImageData(pixels, cols, rows, {
      charset: ascii.charset,
      inverted: ascii.inverted,
      colored: ascii.colored,
    })
  }, [ascii.charset, ascii.colored, ascii.inverted, cols, pixels, rows])

  const plate = React.useMemo(() => {
    if (!pixels || rows < 1 || pixels.length < cols * rows * 4) return undefined
    return asciiPlateColor(pixels, cols * rows)
  }, [cols, pixels, rows])

  const cellWidth = size.width / cols
  const cellHeight = rows > 0 ? size.height / rows : 0
  // Size the font from the cell width so one glyph advance is exactly one cell;
  // the line box then stretches to the cell height to fill the canvas.
  const fontSize = cellWidth / monospaceAdvanceRatio()

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: plate,
        filter,
        opacity: opacity as React.CSSProperties["opacity"],
      }}
    >
      {grid ? (
        <div
          style={{
            fontFamily: ASCII_FONT_FAMILY,
            fontSize: `${fontSize}px`,
            lineHeight: `${cellHeight}px`,
            whiteSpace: "pre",
            fontVariantLigatures: "none",
            color: ascii.colored ? undefined : ascii.color,
          }}
        >
          {Array.from({ length: grid.rows }, (_, row) => (
            <div key={row} style={{ height: `${cellHeight}px` }}>
              {ascii.colored
                ? rowSegments(grid, row).map((segment, i) => (
                    <span key={i} style={{ color: segment.color }}>
                      {segment.text}
                    </span>
                  ))
                : grid.chars.slice(row * grid.cols, (row + 1) * grid.cols)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const AsciiBackdrop = React.memo(AsciiBackdropImpl)
