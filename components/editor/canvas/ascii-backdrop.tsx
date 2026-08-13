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
        {grid ? (
          <svg
            aria-hidden
            data-export-ascii-glyphs="true"
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
            style={{
              display: "block",
              overflow: "hidden",
              fontFamily: ASCII_FONT_FAMILY,
              fontSize: `${fontSize}px`,
              fontVariantLigatures: "none",
              transform: asciiResolutionPreviewTransform(
                displayCols,
                ascii.resolution
              ),
              transformOrigin: "0 0",
            }}
          >
            {Array.from({ length: grid.rows }, (_, row) => {
              const y = (row + 0.5) * cellHeight
              if (!ascii.colored) {
                const text = grid.chars.slice(
                  row * grid.cols,
                  (row + 1) * grid.cols
                )
                const geometry = asciiRunGeometry(0, text.length, cellWidth)
                return (
                  <text
                    key={row}
                    x={geometry.x}
                    y={y}
                    textLength={geometry.width}
                    lengthAdjust="spacingAndGlyphs"
                    dominantBaseline="central"
                    fill={ascii.color}
                    xmlSpace="preserve"
                  >
                    {text}
                  </text>
                )
              }
              return rowSegments(grid, row).map((segment) => {
                const geometry = asciiRunGeometry(
                  segment.start,
                  segment.text.length,
                  cellWidth
                )
                return (
                  <text
                    key={`${row}:${segment.start}`}
                    x={geometry.x}
                    y={y}
                    textLength={geometry.width}
                    lengthAdjust="spacingAndGlyphs"
                    dominantBaseline="central"
                    fill={segment.color}
                    xmlSpace="preserve"
                  >
                    {segment.text}
                  </text>
                )
              })
            })}
          </svg>
        ) : null}
      </div>
    </div>
  )
}

export const AsciiBackdrop = React.memo(AsciiBackdropImpl)
