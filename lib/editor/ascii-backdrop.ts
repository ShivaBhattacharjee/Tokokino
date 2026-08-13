import type {
  Background,
  BackdropAscii,
  BackdropAsciiCharset,
} from "./state-types"
import { clampNumber, editorValueSchemas } from "./value-schemas"

export const ASCII_CHARSETS: Record<BackdropAsciiCharset, string> = {
  standard: " .:-=+*#%@",
  dense:
    " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
  binary: " ..01",
  dots: " .·:∙•●",
  circles: " ·○◔◑◕●",
  stars: " ·˙*✳✻✼❋",
}

export const ASCII_CHARSET_OPTIONS: {
  id: BackdropAsciiCharset
  label: string
}[] = [
  { id: "standard", label: "Standard" },
  { id: "dense", label: "Dense" },
  { id: "blocks", label: "Blocks" },
  { id: "binary", label: "Binary" },
  { id: "dots", label: "Dots" },
  { id: "circles", label: "Circles" },
  { id: "stars", label: "Stars" },
]

// The one range for the ASCII column count — the slider, the store writer and
// the renderer all read it from the Zod schema so they can't drift apart.
const asciiResolutionRange = editorValueSchemas.asciiResolution
export const ASCII_MIN_RESOLUTION = asciiResolutionRange.minValue ?? 20
export const ASCII_MAX_RESOLUTION = asciiResolutionRange.maxValue ?? 200

/** Clamp and round a column count to the schema's range. */
export function normalizeAsciiResolution(raw: number): number {
  return Math.round(
    clampNumber(raw, ASCII_MIN_RESOLUTION, ASCII_MAX_RESOLUTION) ??
      DEFAULT_BACKDROP_ASCII.resolution
  )
}

/**
 * Live-preview var for the resolution slider. Written on the canvas (and
 * preset thumbs) while dragging so glyphs can scale without a store commit
 * or a resample. Cleared on pointer-up after the committed grid paints.
 */
export const ASCII_RESOLUTION_PREVIEW_VAR = "--bd-ascii-resolution"

/**
 * Scale the *currently painted* glyph grid so its cell size matches the
 * live-previewed (or just-committed) column count.
 *
 * `displayedCols` is the grid on screen — the last sample, which lags one
 * async resample behind the store. Using that as the numerator keeps the
 * drag scale in place until the new sample arrives, instead of flashing
 * back to 1× on a stale grid.
 */
export function asciiResolutionPreviewTransform(
  displayedCols: number,
  committedResolution: number
): string {
  const from = Math.max(1, displayedCols)
  const to = normalizeAsciiResolution(committedResolution)
  return `scale(calc(${from} / var(${ASCII_RESOLUTION_PREVIEW_VAR}, ${to})))`
}

const asciiOpacityRange = editorValueSchemas.opacity
export const ASCII_MIN_OPACITY = asciiOpacityRange.minValue ?? 0
export const ASCII_MAX_OPACITY = asciiOpacityRange.maxValue ?? 100

/** Clamp and round a 0–100 opacity to the shared schema's range. */
export function normalizeAsciiOpacity(raw: number): number {
  return Math.round(
    clampNumber(raw, ASCII_MIN_OPACITY, ASCII_MAX_OPACITY) ??
      DEFAULT_BACKDROP_ASCII.opacity
  )
}

/**
 * Character cell width ÷ height. Monospace glyphs are roughly twice as tall as
 * they are wide, so the sampling grid uses the same ratio and the picture keeps
 * the background's aspect instead of squashing it.
 */
export const ASCII_CELL_ASPECT = 0.5

export const ASCII_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

export const DEFAULT_BACKDROP_ASCII: BackdropAscii = {
  enabled: false,
  resolution: 90,
  charset: "standard",
  colored: true,
  inverted: false,
  color: "#FFFFFF",
  opacity: 100,
}

export function resolveBackdropAscii(
  ascii: BackdropAscii | undefined
): BackdropAscii {
  if (!ascii) return DEFAULT_BACKDROP_ASCII
  const merged = { ...DEFAULT_BACKDROP_ASCII, ...ascii }
  const resolution = normalizeAsciiResolution(merged.resolution)
  const opacity = normalizeAsciiOpacity(merged.opacity)
  if (resolution === merged.resolution && opacity === merged.opacity) {
    return merged
  }
  return { ...merged, resolution, opacity }
}

export function isAsciiBackdropActive(
  ascii: BackdropAscii | undefined,
  background: Background
): boolean {
  return Boolean(ascii?.enabled) && background.type !== "none"
}

/** Rows that keep square-ish cells for a canvas of the given aspect ratio. */
export function asciiRowCount(
  cols: number,
  width: number,
  height: number
): number {
  if (!(width > 0) || !(height > 0)) return 0
  const cellWidth = width / cols
  const cellHeight = cellWidth / ASCII_CELL_ASPECT
  return Math.max(1, Math.round(height / cellHeight))
}

/**
 * Pixel surface whose aspect matches the canvas area represented by a glyph
 * grid. Grid rows are counts, not square pixels: every cell is
 * {@link ASCII_CELL_ASPECT} as wide as it is tall. Sampling a cover-fitted
 * background at raw `cols × rows` would therefore crop a different region.
 */
export function asciiSamplingSurfaceSize(
  cols: number,
  rows: number
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cols)),
    height: Math.max(1, Math.round(rows / ASCII_CELL_ASPECT)),
  }
}

/** Exact SVG geometry for a run of ASCII glyph cells. */
export function asciiRunGeometry(
  startCell: number,
  cellCount: number,
  cellWidth: number
): { x: number; width: number } {
  const safeStart = Math.max(0, startCell)
  const safeCount = Math.max(0, cellCount)
  const safeCellWidth = Math.max(0, cellWidth)
  return {
    x: safeStart * safeCellWidth,
    width: safeCount * safeCellWidth,
  }
}

/**
 * Ceiling on cells (≈ DOM nodes) in one grid. Rows scale with the canvas's
 * aspect, so the column count alone doesn't bound the grid: 200 columns is
 * ~11k cells on 16:9 but ~36k on a 9:16 story canvas, and Animate mode mounts
 * one grid per ASCII/background/filter keyframe. This trades a few columns on
 * tall canvases for a bounded node count. Landscape at full resolution is
 * unaffected.
 */
export const ASCII_MAX_CELLS = 12_000

/**
 * The grid to actually render: the requested columns, reduced if the resulting
 * cell count would blow the budget. Both dimensions shrink together so the
 * characters keep their aspect.
 */
export function asciiGridSize(
  requestedCols: number,
  width: number,
  height: number
): { cols: number; rows: number } {
  const cols = normalizeAsciiResolution(requestedCols)
  const rows = asciiRowCount(cols, width, height)
  if (rows < 1) return { cols, rows: 0 }
  const cells = cols * rows
  if (cells <= ASCII_MAX_CELLS) return { cols, rows }
  const scaled = Math.max(
    ASCII_MIN_RESOLUTION,
    Math.floor(cols * Math.sqrt(ASCII_MAX_CELLS / cells))
  )
  return { cols: scaled, rows: asciiRowCount(scaled, width, height) }
}

export type AsciiGrid = {
  cols: number
  rows: number
  /** `cols * rows` characters, row-major. */
  chars: string
  /** `cols * rows` CSS colours, row-major. Empty when the grid is monochrome. */
  colors: string[]
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Quantize to 32 levels per channel so runs of near-identical colour merge. */
function quantizedColor(r: number, g: number, b: number): string {
  const q = (v: number) => Math.min(255, (v & 0xf8) + 4)
  return `rgb(${q(r)},${q(g)},${q(b)})`
}

export function gridFromImageData(
  data: Uint8ClampedArray,
  cols: number,
  rows: number,
  options: {
    charset: BackdropAsciiCharset
    inverted: boolean
    colored: boolean
  }
): AsciiGrid {
  const ramp = ASCII_CHARSETS[options.charset] ?? ASCII_CHARSETS.standard
  const last = ramp.length - 1
  const chars = new Array<string>(cols * rows)
  const colors = options.colored ? new Array<string>(cols * rows) : []
  for (let i = 0; i < cols * rows; i++) {
    const p = i * 4
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const alpha = data[p + 3] / 255
    // Unpainted pixels read as "dark" rather than as whatever the RGB happens
    // to be, so a transparent background maps to the sparse end of the ramp.
    const lum = luminance(r, g, b) * alpha
    const level = options.inverted ? 1 - lum : lum
    chars[i] = ramp[Math.max(0, Math.min(last, Math.round(level * last)))]
    if (options.colored) colors[i] = quantizedColor(r, g, b)
  }
  return { cols, rows, chars: chars.join(""), colors }
}

/**
 * The plate the glyphs sit on: the background's own darkest tone, dimmed. The
 * ASCII layer covers the background it was sampled from, so drawing characters
 * straight onto that background would leave them near-invisible — and picking
 * the colour by hand is a knob nobody wants to turn. Deriving it keeps the
 * canvas reading as the same artwork.
 */
export function asciiPlateColor(
  data: Uint8ClampedArray,
  cells: number
): string {
  let best = Number.POSITIVE_INFINITY
  let rgb: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < cells; i++) {
    const p = i * 4
    const alpha = data[p + 3] / 255
    const lum = luminance(data[p], data[p + 1], data[p + 2]) * alpha
    if (lum < best) {
      best = lum
      rgb = [data[p] * alpha, data[p + 1] * alpha, data[p + 2] * alpha]
    }
  }
  const dim = 0.55
  return `rgb(${Math.round(rgb[0] * dim)},${Math.round(rgb[1] * dim)},${Math.round(
    rgb[2] * dim
  )})`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Reading pixels back needs an untainted canvas, so anything cross-origin goes
 * through the same proxy the exporter uses.
 */
function readableImageUrl(url: string): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url
  if (isSameOriginUrl(url)) return url
  try {
    const parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) return url
    return `/api/export/image?url=${encodeURIComponent(url)}`
  } catch {
    return url
  }
}

/**
 * An `<img>` that never fires load or error (a stalled request) would otherwise
 * leave a sample pending forever — and export waits for every pending sample.
 * Bounding it here is what lets that wait be unbounded: every sample settles.
 */
const IMAGE_LOAD_TIMEOUT_MS = 15_000

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = setTimeout(() => {
      img.src = ""
      reject(new Error(`ascii backdrop: timed out loading ${src}`))
    }, IMAGE_LOAD_TIMEOUT_MS)
    img.crossOrigin = "anonymous"
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error(`ascii backdrop: cannot load ${src}`))
    }
    img.src = src
  })
}

/**
 * Rasterize a CSS background value at the grid's resolution. Gradients and
 * solids have no canvas equivalent, so they are painted by the browser inside a
 * `<foreignObject>` and read back — cheap here because the grid is tiny.
 */
async function rasterizeCssBackground(
  value: string,
  cols: number,
  rows: number
): Promise<HTMLImageElement> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols}" height="${rows}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${cols}px;height:${rows}px;background:${escapeXml(
    value
  )}"></div></foreignObject></svg>`
  return loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  )
}

/** Cover-fit source rect, matching `background-size: cover` on the canvas. */
function coverRect(
  sw: number,
  sh: number,
  dw: number,
  dh: number
): [number, number, number, number] {
  if (!(sw > 0) || !(sh > 0)) return [0, 0, sw, sh]
  const scale = Math.max(dw / sw, dh / sh)
  const w = dw / scale
  const h = dh / scale
  return [(sw - w) / 2, (sh - h) / 2, w, h]
}

/** Cover crop used when an image background is sampled into an ASCII grid. */
export function asciiImageCoverRect(
  sourceWidth: number,
  sourceHeight: number,
  cols: number,
  rows: number
): [number, number, number, number] {
  const surface = asciiSamplingSurfaceSize(cols, rows)
  return coverRect(sourceWidth, sourceHeight, surface.width, surface.height)
}

const sampleCache = new Map<string, Uint8ClampedArray>()
const SAMPLE_CACHE_LIMIT = 24

export function backgroundSampleKey(
  background: Background,
  cols: number,
  rows: number
): string {
  return `${background.type}|${background.value}|${cols}x${rows}`
}

/**
 * Sampling is async, but export rasterizes (or clones) whatever is in the DOM
 * *now* — so an export fired right after ASCII is switched on, or after its
 * background/resolution changes, would capture a canvas with no glyphs on it.
 * Every in-flight sample registers here and the export paths await this first.
 */
const pendingSamples = new Set<Promise<void>>()

/**
 * Whether anything has sampled this session — i.e. whether glyphs can exist at
 * all. An empty pending set does NOT mean the DOM is ready: a sample's tracking
 * handler is attached before the caller's, so the set empties an earlier
 * microtask than the `setPixels` that draws the result. Only a session that
 * never sampled can skip the wait outright.
 */
let hasSampled = false

export async function waitForAsciiBackdrops(): Promise<void> {
  if (!hasSampled) return
  // No deadline: returning with work still pending is exactly the race this
  // exists to close — a bounded wait would hand the exporter a half-drawn
  // backdrop and call it done. Every sample is guaranteed to settle (see
  // IMAGE_LOAD_TIMEOUT_MS), and the loop re-checks because a settling sample
  // can queue another one.
  while (pendingSamples.size > 0) {
    await Promise.all([...pendingSamples])
  }
  // A settled sample is still only React state — give it the frames it needs to
  // commit the grid into the DOM the exporter is about to read. This runs even
  // when nothing was pending, because "settled" and "painted" are not the same
  // instant and the exporter reads the painted DOM.
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      resolve()
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/**
 * RGBA for a `cols × rows` downsample of the background, one pixel per
 * character cell.
 */
export function sampleBackgroundPixels(
  background: Background,
  cols: number,
  rows: number
): Promise<Uint8ClampedArray | null> {
  hasSampled = true
  const sample = sampleBackgroundPixelsUncached(background, cols, rows)
  // Never rejects, so the tracked copy can't raise an unhandled rejection —
  // the caller still sees the original promise's failure.
  const settled = sample.then(
    () => undefined,
    () => undefined
  )
  pendingSamples.add(settled)
  void settled.then(() => pendingSamples.delete(settled))
  return sample
}

async function sampleBackgroundPixelsUncached(
  background: Background,
  cols: number,
  rows: number
): Promise<Uint8ClampedArray | null> {
  if (background.type === "none" || cols < 1 || rows < 1) return null
  const key = backgroundSampleKey(background, cols, rows)
  const cached = sampleCache.get(key)
  if (cached) return cached

  const sampleSize = asciiSamplingSurfaceSize(cols, rows)
  const sourceCanvas = document.createElement("canvas")
  sourceCanvas.width = sampleSize.width
  sourceCanvas.height = sampleSize.height
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true })
  if (!sourceCtx) return null

  if (background.type === "image") {
    const img = await loadImage(readableImageUrl(background.value))
    const [sx, sy, sw, sh] = asciiImageCoverRect(
      img.naturalWidth,
      img.naturalHeight,
      cols,
      rows
    )
    sourceCtx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      sampleSize.width,
      sampleSize.height
    )
  } else {
    const img = await rasterizeCssBackground(
      background.value,
      sampleSize.width,
      sampleSize.height
    )
    sourceCtx.drawImage(img, 0, 0, sampleSize.width, sampleSize.height)
  }

  const gridCanvas = document.createElement("canvas")
  gridCanvas.width = cols
  gridCanvas.height = rows
  const gridCtx = gridCanvas.getContext("2d", { willReadFrequently: true })
  if (!gridCtx) return null
  gridCtx.drawImage(sourceCanvas, 0, 0, cols, rows)
  const { data } = gridCtx.getImageData(0, 0, cols, rows)
  if (sampleCache.size >= SAMPLE_CACHE_LIMIT) {
    const oldest = sampleCache.keys().next().value
    if (oldest !== undefined) sampleCache.delete(oldest)
  }
  sampleCache.set(key, data)
  return data
}

let advanceRatio: number | null = null

/**
 * Width of one glyph as a fraction of font size for {@link ASCII_FONT_FAMILY}.
 * Measured once — the ratio differs per platform (Menlo ≈ 0.6, Consolas ≈ 0.55)
 * and the grid has to line up with whichever font actually resolves.
 */
export function monospaceAdvanceRatio(): number {
  if (advanceRatio !== null) return advanceRatio
  const fallback = 0.6
  try {
    const ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return fallback
    ctx.font = `100px ${ASCII_FONT_FAMILY}`
    const width = ctx.measureText("M").width / 100
    advanceRatio = width > 0.2 && width < 1.5 ? width : fallback
  } catch {
    advanceRatio = fallback
  }
  return advanceRatio
}
