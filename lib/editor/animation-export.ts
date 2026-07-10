/**
 * Fully local animation export (user device only — no server).
 *
 * Pipeline:
 *  1. Sample Tokokino keyframes onto an offscreen DOM clone (html-to-image)
 *  2. GIF  → gifenc (pure JS palette encode)
 *  3. Video → Mediabunny + WebCodecs (hardware-accelerated, faster than real-time)
 *             with MediaRecorder fallback when WebCodecs is unavailable
 */

import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from "mediabunny"

import {
  applyAnimationFrameAtTime,
  clearAnimationFrameVars,
  measureBareStageDims,
} from "./apply-animation-frame"
import {
  prepareAnimationCapture,
  prepareFastAnimationCapture,
  type AnimationCapture,
} from "./export"
import { captureClipPose, useEditorStore } from "./store"
import type { AnimationClip, CanvasState } from "./state-types"

export type AnimationExportFormat = "webm" | "mp4" | "gif"

export type AnimationExportPhase =
  | "preparing"
  | "capturing"
  | "encoding"
  | "finishing"

export type AnimationExportProgress = {
  phase: AnimationExportPhase
  current: number
  total: number
  etaMs: number | null
}

/**
 * Frame-capture strategy.
 *  - `fast`   — reused-clone `<foreignObject>` path. Sets up the clone/assets once
 *               and bakes computed styles per frame (no re-clone, no re-embed, no
 *               paint wait). Faster; correct for every canvas.
 *  - `legacy` — html-to-image path (exposed as "Precise"). Fully re-processes the
 *               DOM each frame. Slower, kept as a fallback.
 *  - `auto`   — fast, falling back to legacy only if fast setup throws. Default.
 */
export type AnimationCaptureMode = "auto" | "fast" | "legacy"

export type AnimationExportOptions = {
  format: AnimationExportFormat
  fps?: number
  targetWidth?: number
  /** Draw the "Designed by Tokokino" watermark on every frame. Defaults to on. */
  watermark?: boolean
  /** Frame-capture strategy. Defaults to `auto`. */
  capture?: AnimationCaptureMode
  onProgress?: (progress: AnimationExportProgress) => void
  signal?: AbortSignal
  /**
   * When true, return the encoded blob instead of downloading it.
   * Used by Share to upload animations without forcing a local download.
   */
  asBlob?: boolean
}

export type AnimationExportBlobResult = {
  blob: Blob
  contentType: string
  extension: string
}

const MAX_FRAMES = 600

const WATERMARK_LOGO_SRC = "/logo.png"
const WATERMARK_PREFIX = "Designed by"
const WATERMARK_APP_NAME = "Tokokino"
const WATERMARK_FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

type WatermarkAssets = { logo: HTMLImageElement | null }

/**
 * Preload the watermark logo once before the frame loop. Same-origin (`/logo.png`)
 * so it never taints the canvas that GIF export reads back via getImageData.
 * Resolves to `null` on failure so the text-only watermark still renders.
 */
function loadWatermarkLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = WATERMARK_LOGO_SRC
  })
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * Bottom-left "Designed by Tokokino" watermark, painted straight onto the frame
 * canvas so it survives every encoder (GIF / WebCodecs / MediaRecorder) without
 * touching the DOM capture clone. Scales with the frame's shorter edge.
 */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assets: WatermarkAssets
) {
  const minEdge = Math.max(1, Math.min(width, height))
  const scale = Math.max(0.72, Math.min(1.6, minEdge / 720))
  const margin = Math.round(18 * scale)
  const padX = Math.round(12 * scale)
  const padY = Math.round(9 * scale)
  const gap = Math.round(9 * scale)
  const logoSize = Math.round(26 * scale)
  const prefixSize = Math.round(11 * scale)
  const nameSize = Math.round(17 * scale)
  const lineGap = Math.round(2 * scale)
  const logo = assets.logo

  ctx.save()
  // Keep the whole mark subtle so it reads as a credit, not a banner.
  ctx.globalAlpha = 0.32

  ctx.font = `500 ${prefixSize}px ${WATERMARK_FONT_STACK}`
  const prefixWidth = ctx.measureText(WATERMARK_PREFIX).width
  ctx.font = `700 ${nameSize}px ${WATERMARK_FONT_STACK}`
  const nameWidth = ctx.measureText(WATERMARK_APP_NAME).width
  const textWidth = Math.max(prefixWidth, nameWidth)
  const textHeight = prefixSize + lineGap + nameSize

  const logoBlock = logo ? logoSize + gap : 0
  const contentW = logoBlock + textWidth
  const contentH = Math.max(logo ? logoSize : 0, textHeight)

  const pillW = contentW + padX * 2
  const pillH = contentH + padY * 2
  const pillX = margin
  const pillY = height - margin - pillH

  traceRoundRect(ctx, pillX, pillY, pillW, pillH, Math.round(10 * scale))
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)"
  ctx.fill()

  const centerY = pillY + pillH / 2
  const contentX = pillX + padX
  let textX = contentX
  if (logo) {
    try {
      ctx.drawImage(logo, contentX, centerY - logoSize / 2, logoSize, logoSize)
    } catch {
      /* ignore a broken logo — keep the text */
    }
    textX = contentX + logoSize + gap
  }

  const textTop = centerY - textHeight / 2
  ctx.textBaseline = "top"
  ctx.font = `500 ${prefixSize}px ${WATERMARK_FONT_STACK}`
  ctx.fillStyle = "rgba(255, 255, 255, 0.74)"
  ctx.fillText(WATERMARK_PREFIX, textX, textTop)
  ctx.font = `700 ${nameSize}px ${WATERMARK_FONT_STACK}`
  ctx.fillStyle = "rgba(255, 255, 255, 0.97)"
  ctx.fillText(WATERMARK_APP_NAME, textX, textTop + prefixSize + lineGap)

  ctx.restore()
}

/**
 * Resolve the frame-capture strategy and build it, honoring the requested mode.
 *
 * `auto` uses the fast path for every canvas — the per-frame computed-style bake
 * resolves theme and container queries, so device frames are safe too — and falls
 * back to the html-to-image path only if fast setup throws, so an export never
 * hard-fails on a capable browser.
 */
async function acquireAnimationCapture(
  canvasId: string,
  targetWidth: number,
  mode: AnimationCaptureMode
): Promise<AnimationCapture> {
  if (mode === "legacy") return prepareAnimationCapture(canvasId, targetWidth)
  if (mode === "fast") return prepareFastAnimationCapture(canvasId, targetWidth)

  // auto
  try {
    return await prepareFastAnimationCapture(canvasId, targetWidth)
  } catch (err) {
    console.warn(
      "[export] fast capture setup failed, using html-to-image:",
      err
    )
    return prepareAnimationCapture(canvasId, targetWidth)
  }
}

export class AnimationExportAbortedError extends Error {
  constructor(message = "Export cancelled") {
    super(message)
    this.name = "AnimationExportAbortedError"
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AnimationExportAbortedError()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function even(n: number) {
  const r = Math.max(2, Math.round(n))
  return r % 2 === 0 ? r : r + 1
}

function pickWebmMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type
    }
  }
  return "video/webm"
}

function suppressCloneTransitions(node: HTMLElement) {
  const targets = Array.from(
    node.querySelectorAll<HTMLElement>(
      "[data-editor-shadow-filter-target], [data-editor-shadow-box-target], [data-screenshot-slot-id], [data-editor-shadow-preview-scope]"
    )
  )
  for (const el of [node, ...targets]) {
    el.style.transition = "none"
  }
}

function applyExportFrame(
  node: HTMLElement,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number
) {
  applyAnimationFrameAtTime({
    canvasEl: node,
    canvas,
    globalAspect,
    clips,
    timeMs,
    selectedClipId: null,
    screenshotPositionDragging: false,
    bareDims: measureBareStageDims(node),
  })
}

type ProgressReporter = {
  report: (phase: AnimationExportPhase, current: number, total: number) => void
}

/**
 * Always report progress; the UI layer throttles React updates so we can show
 * Frame X/Y without re-rendering on every single frame.
 */
function createProgressReporter(
  onProgress?: (p: AnimationExportProgress) => void
): ProgressReporter {
  let phaseStartedAt = performance.now()
  let lastPhase: AnimationExportPhase | null = null

  return {
    report(phase, current, total) {
      if (!onProgress) return
      if (phase !== lastPhase) {
        lastPhase = phase
        phaseStartedAt = performance.now()
      }
      let etaMs: number | null = null
      if (current > 0 && current < total) {
        const elapsed = performance.now() - phaseStartedAt
        etaMs = Math.max(0, Math.round((elapsed / current) * (total - current)))
      } else if (current >= total && total > 0) {
        etaMs = 0
      }
      onProgress({ phase, current, total, etaMs })
    },
  }
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/** Sources `CanvasRenderingContext2D.drawImage` accepts in practice. */
type DrawImageSource =
  | HTMLCanvasElement
  | HTMLImageElement
  | HTMLVideoElement
  | ImageBitmap
  | OffscreenCanvas
  | SVGImageElement

function isDrawImageSource(value: unknown): value is DrawImageSource {
  if (value == null || typeof value !== "object") return false
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    value instanceof HTMLCanvasElement
  ) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    value instanceof OffscreenCanvas
  ) {
    return value.width > 0 && value.height > 0
  }
  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return value.width > 0 && value.height > 0
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    value instanceof HTMLImageElement
  ) {
    return value.naturalWidth > 0 && value.naturalHeight > 0
  }
  if (
    typeof HTMLVideoElement !== "undefined" &&
    value instanceof HTMLVideoElement
  ) {
    return value.videoWidth > 0 && value.videoHeight > 0
  }
  if (
    typeof SVGImageElement !== "undefined" &&
    value instanceof SVGImageElement
  ) {
    return true
  }
  return false
}

/**
 * Safe drawImage — Safari/Firefox (and flaky html-to-image captures) can hand
 * back a non-canvas / zero-size value that throws a TypeError in drawImage.
 * Returns false when the source is unusable so callers can skip/retry.
 */
function safeDrawImage(
  ctx: CanvasRenderingContext2D,
  source: unknown,
  dx = 0,
  dy = 0,
  dw?: number,
  dh?: number
): boolean {
  if (!isDrawImageSource(source)) return false
  try {
    if (dw != null && dh != null) ctx.drawImage(source, dx, dy, dw, dh)
    else ctx.drawImage(source, dx, dy)
    return true
  } catch {
    return false
  }
}

function blankFrame(width: number, height: number): HTMLCanvasElement {
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, width)
  copy.height = Math.max(1, height)
  const ctx = copy.getContext("2d")
  if (ctx) {
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, copy.width, copy.height)
  }
  return copy
}

function snapshotFrame(
  source: unknown,
  fallbackWidth: number,
  fallbackHeight: number
): HTMLCanvasElement {
  if (!isDrawImageSource(source)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  const w =
    "width" in source && typeof source.width === "number" && source.width > 0
      ? source.width
      : fallbackWidth
  const h =
    "height" in source && typeof source.height === "number" && source.height > 0
      ? source.height
      : fallbackHeight
  const copy = document.createElement("canvas")
  copy.width = Math.max(1, w)
  copy.height = Math.max(1, h)
  const ctx = copy.getContext("2d")
  if (!ctx) return blankFrame(fallbackWidth, fallbackHeight)
  if (!safeDrawImage(ctx, source, 0, 0)) {
    return blankFrame(fallbackWidth, fallbackHeight)
  }
  return copy
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Re-draw portrait `blur`/`stage` depth-of-field onto a captured frame.
 *
 * These modes fake DoF with `backdrop-filter: blur()` + a vertical gradient mask
 * on an `inset-0` overlay — blurring the whole canvas in a band and leaving a
 * sharp strip around `position`. `backdrop-filter` can't rasterize inside a
 * `<foreignObject>`, so the overlay is neutralized during capture (see
 * `makeExportStyle`) and the effect is reconstructed here in 2D: blur the frame,
 * keep it only inside the masked band, and composite it back at the overlay's
 * (possibly animated) opacity. Reads the live clone so crossfades are respected.
 */
function drawPortraitDepthOfField(frame: HTMLCanvasElement, node: HTMLElement) {
  const els = node.querySelectorAll<HTMLElement>("[data-export-portrait-fx]")
  if (els.length === 0) return
  const ctx = frame.getContext("2d")
  const nodeRect = node.getBoundingClientRect()
  if (!ctx || !nodeRect.height) return
  const scaleY = frame.height / nodeRect.height

  for (const el of Array.from(els)) {
    const cs = window.getComputedStyle(el)
    const opacity = parseFloat(cs.opacity) || 0
    if (opacity <= 0.01) continue

    const mode = el.getAttribute("data-export-portrait-fx")
    const position = parseFloat(
      el.getAttribute("data-portrait-position") ?? "50"
    )
    const distance = parseFloat(
      el.getAttribute("data-portrait-distance") ?? "50"
    )
    const intensity = parseFloat(
      el.getAttribute("data-portrait-intensity") ?? "0"
    )

    const rect = el.getBoundingClientRect()
    const boxTop = (rect.top - nodeRect.top) * scaleY
    const boxH = rect.height * scaleY
    if (boxH <= 0) continue

    // Same mask math as helpers.ts `portraitOverlayCss`: opaque (blurred) below
    // `position-distance` and above `position+distance`, transparent (sharp) at
    // `position`. `0deg` gradient → offset 0 is the box bottom.
    const s0 = clamp01((position - distance) / 100)
    const s1 = clamp01(position / 100)
    const s2 = clamp01((position + distance) / 100)
    const makeMask = (c: CanvasRenderingContext2D) => {
      const g = c.createLinearGradient(0, boxTop + boxH, 0, boxTop)
      g.addColorStop(0, "rgba(255,255,255,1)")
      g.addColorStop(s0, "rgba(255,255,255,1)")
      g.addColorStop(s1, "rgba(255,255,255,0)")
      g.addColorStop(s2, "rgba(255,255,255,1)")
      g.addColorStop(1, "rgba(255,255,255,1)")
      return g
    }

    const blurEm = (100 - clamp01(distance / 100) * 100) * 0.01
    const fontSize = parseFloat(cs.fontSize) || 16
    const blurPx = blurEm * fontSize * scaleY

    if (blurPx >= 0.5) {
      const layer = document.createElement("canvas")
      layer.width = frame.width
      layer.height = frame.height
      const lc = layer.getContext("2d")
      if (lc) {
        lc.filter = `blur(${blurPx}px)`
        lc.drawImage(frame, 0, 0)
        lc.filter = "none"
        lc.globalCompositeOperation = "destination-in"
        lc.fillStyle = makeMask(lc)
        lc.fillRect(0, boxTop, frame.width, boxH)
        ctx.save()
        ctx.globalAlpha = opacity
        ctx.drawImage(layer, 0, 0)
        ctx.restore()
      }
    }

    if (mode === "stage") {
      const tintAlpha = 0.3 * clamp01(intensity / 100)
      if (tintAlpha > 0.001) {
        const tint = document.createElement("canvas")
        tint.width = frame.width
        tint.height = frame.height
        const tc = tint.getContext("2d")
        if (tc) {
          tc.fillStyle = `rgba(0,0,0,${tintAlpha})`
          tc.fillRect(0, boxTop, frame.width, boxH)
          tc.globalCompositeOperation = "destination-in"
          tc.fillStyle = makeMask(tc)
          tc.fillRect(0, boxTop, frame.width, boxH)
          ctx.save()
          ctx.globalAlpha = opacity
          ctx.drawImage(tint, 0, 0)
          ctx.restore()
        }
      }
    }
  }
}

async function captureStableFrame(
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number
): Promise<HTMLCanvasElement> {
  applyExportFrame(capture.node, canvas, globalAspect, clips, timeMs)
  // The fast path serializes the clone's inline styles synchronously, so it
  // needs no browser paint between mutation and capture. The html-to-image path
  // reads live computed styles and does.
  if (capture.needsPaint) await waitForPaint()
  let raw: unknown
  try {
    raw = await capture.captureFrame()
  } catch {
    return blankFrame(capture.width, capture.height)
  }
  // html-to-image is flaky on some browsers — one retry after another paint.
  if (!isDrawImageSource(raw)) {
    if (capture.needsPaint) await waitForPaint()
    try {
      raw = await capture.captureFrame()
    } catch {
      return blankFrame(capture.width, capture.height)
    }
  }
  const frame = snapshotFrame(raw, capture.width, capture.height)
  // Re-draw portrait blur/stage DoF (backdrop-filter can't rasterize) as content,
  // before any watermark. Reads the clone so animated crossfade opacity applies.
  drawPortraitDepthOfField(frame, capture.node)
  return frame
}

type CaptureCtx = {
  capture: Awaited<ReturnType<typeof prepareAnimationCapture>>
  canvas: CanvasState
  globalAspect: { id: string; w: number; h: number }
  clips: AnimationClip[]
  frameCount: number
  frameDurationMs: number
  fps: number
  progress: ProgressReporter
  signal?: AbortSignal
  /** Non-null when the watermark should be painted onto every frame. */
  watermark: WatermarkAssets | null
}

function animationMimeAndExt(format: AnimationExportFormat): {
  contentType: string
  extension: string
} {
  if (format === "gif") return { contentType: "image/gif", extension: "gif" }
  if (format === "mp4") return { contentType: "video/mp4", extension: "mp4" }
  return { contentType: "video/webm", extension: "webm" }
}

/**
 * Render the active canvas's animation timeline.
 * 100% on-device encode — download by default, or return a blob for Share.
 */
export async function exportAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<void | AnimationExportBlobResult> {
  const result = await encodeAnimation(canvasId, options)
  if (options.asBlob) return result
  triggerDownload(
    result.blob,
    `tokokino-animation-${Date.now()}.${result.extension}`
  )
}

/** Encode animation and always return the blob (for share uploads). */
export async function exportAnimationBlob(
  canvasId: string,
  options: Omit<AnimationExportOptions, "asBlob">
): Promise<AnimationExportBlobResult> {
  return encodeAnimation(canvasId, { ...options, asBlob: true })
}

async function encodeAnimation(
  canvasId: string,
  options: AnimationExportOptions
): Promise<AnimationExportBlobResult> {
  const { onProgress, signal } = options
  const progress = createProgressReporter(onProgress)

  throwIfAborted(signal)
  progress.report("preparing", 0, 1)

  const state = useEditorStore.getState()
  const canvas = state.present.canvases.find((c) => c.id === canvasId)
  const animation = canvas?.animation
  if (!canvas || !animation) throw new Error("Nothing to export")

  const { durationMs, audio } = animation
  const clips =
    state.isAnimateMode && state.selectedAnimationClipId
      ? animation.clips.map((clip) =>
          clip.id === state.selectedAnimationClipId
            ? { ...clip, pose: captureClipPose(canvas) }
            : clip
        )
      : animation.clips
  if (!clips.length) throw new Error("Add at least one keyframe before sharing")

  const fps = Math.max(1, Math.min(60, options.fps ?? 30))
  const frameCount = Math.min(
    MAX_FRAMES,
    Math.max(1, Math.round((durationMs / 1000) * fps))
  )
  const frameDurationMs = 1000 / fps
  const targetWidth =
    options.targetWidth ??
    (options.format === "gif" ? 720 : options.format === "mp4" ? 1080 : 1080)

  // Added unless explicitly disabled — mirrors the still-image export toggle.
  const watermark =
    options.watermark === false ? null : { logo: await loadWatermarkLogo() }

  throwIfAborted(signal)
  const capture = await acquireAnimationCapture(
    canvasId,
    targetWidth,
    options.capture ?? "auto"
  )
  suppressCloneTransitions(capture.node)
  progress.report("preparing", 1, 1)

  const ctx: CaptureCtx = {
    capture,
    canvas,
    globalAspect: state.present.aspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
    watermark,
  }

  try {
    let blob: Blob
    if (options.format === "gif") {
      blob = await encodeGif(ctx)
    } else {
      const encoded = await tryEncodeWithMediabunny(ctx, options.format)
      if (encoded) {
        blob = encoded
      } else {
        if (options.format === "mp4") {
          throw new Error(
            "MP4 export needs WebCodecs (Chrome, Edge, or Safari 17+). Try WebM or update your browser."
          )
        }
        // WebM fallback — MediaRecorder (also fully local)
        blob = await encodeWebmMediaRecorder({
          ...ctx,
          durationMs,
          audio: audio && !audio.muted && audio.src ? audio : null,
        })
      }
    }
    progress.report("finishing", 1, 1)
    const { contentType, extension } = animationMimeAndExt(options.format)
    // Prefer the blob's own type when the encoder set one.
    return {
      blob,
      contentType: blob.type || contentType,
      extension,
    }
  } finally {
    clearAnimationFrameVars(capture.node, clips)
    capture.cleanup()
  }
}

/** Frames to sample when building the shared palette — enough to cover the
 *  clip's color range without feeding every pixel of every frame to quantize. */
const GIF_PALETTE_SAMPLE_FRAMES = 16

// 8×8 Bayer threshold matrix (values 0–63) for ordered dithering. Ordered
// dithering is deterministic — the same spatial pattern every frame — so it
// smooths the banding a 256-color palette produces on photographic/image
// backgrounds without the temporal flicker that error-diffusion would add.
// prettier-ignore
const BAYER_8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]

/**
 * Pick a dither strength from the palette's own coarseness: the mean distance
 * from each palette color to its nearest neighbor approximates the quantization
 * step, so we dither by a bit less than that. A palette with big gaps (rich
 * image, lots of banding) gets stronger dithering; a tight palette gets almost
 * none, keeping flat UI areas clean.
 */
function paletteDitherAmplitude(palette: Palette): number {
  let sum = 0
  let count = 0
  for (let i = 0; i < palette.length; i++) {
    const a = palette[i]
    let nearest = Infinity
    for (let j = 0; j < palette.length; j++) {
      if (i === j) continue
      const b = palette[j]
      const dr = a[0] - b[0]
      const dg = a[1] - b[1]
      const db = a[2] - b[2]
      const d = dr * dr + dg * dg + db * db
      if (d < nearest) nearest = d
    }
    if (nearest < Infinity) {
      sum += Math.sqrt(nearest)
      count++
    }
  }
  const meanStep = count ? sum / count : 24
  return Math.max(6, Math.min(40, meanStep * 0.75))
}

/**
 * Apply ordered (Bayer) dithering in place before palette mapping. Adds a
 * per-pixel threshold offset so `applyPalette`'s nearest-color pick alternates
 * between neighboring palette entries across a smooth region — the eye blends
 * them back into a gradient instead of seeing hard bands. Uint8ClampedArray
 * rounds/clamps on assignment, so no manual clamping is needed.
 */
function orderedDither(img: ImageData, amplitude: number) {
  const { data, width, height } = img
  for (let y = 0; y < height; y++) {
    const bayerRow = (y & 7) << 3
    for (let x = 0; x < width; x++) {
      const t = (BAYER_8[bayerRow + (x & 7)] / 64 - 0.5) * amplitude
      const p = (y * width + x) << 2
      data[p] = data[p] + t
      data[p + 1] = data[p + 1] + t
      data[p + 2] = data[p + 2] + t
    }
  }
}

/**
 * Build one 256-color palette for the whole clip from a handful of evenly
 * spaced frames, then re-map every frame onto it. A single shared palette is
 * what stops the frame-to-frame color shimmer you get from quantizing each
 * frame independently — and it moves the expensive `quantize` off the per-frame
 * path (run once instead of N times), which is most of the speedup.
 */
function buildGifPalette(frames: ImageData[]): Palette {
  const stride = Math.max(
    1,
    Math.floor(frames.length / GIF_PALETTE_SAMPLE_FRAMES)
  )
  const samples: Uint8ClampedArray[] = []
  for (let i = 0; i < frames.length; i += stride) samples.push(frames[i].data)
  // Always include the last frame so end-state colors are represented.
  const last = frames[frames.length - 1]?.data
  if (last && samples[samples.length - 1] !== last) samples.push(last)

  let total = 0
  for (const s of samples) total += s.length
  const combined = new Uint8Array(total)
  let offset = 0
  for (const s of samples) {
    combined.set(s, offset)
    offset += s.length
  }
  return quantize(combined, 256)
}

async function encodeGif(ctx: CaptureCtx) {
  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    progress,
    signal,
    watermark,
  } = ctx

  // Pass 1 — capture every frame's pixels. Buffering the frames lets us build a
  // single shared palette (pass 2) instead of one per frame; the WebM path
  // buffers frames the same way, so peak memory is in line with existing exports.
  progress.report("capturing", 0, frameCount)
  const frames: ImageData[] = []
  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    const frameCanvas = await captureStableFrame(
      capture,
      canvas,
      globalAspect,
      clips,
      f * frameDurationMs
    )
    const gctx = frameCanvas.getContext("2d")
    if (!gctx) {
      progress.report("capturing", f + 1, frameCount)
      continue
    }
    if (watermark) {
      drawWatermark(gctx, frameCanvas.width, frameCanvas.height, watermark)
    }
    frames.push(gctx.getImageData(0, 0, frameCanvas.width, frameCanvas.height))
    progress.report("capturing", f + 1, frameCount)
  }

  if (frames.length === 0) throw new Error("No frames captured for GIF export")

  // Pass 2 — one palette for the whole clip, then re-map + write each frame.
  throwIfAborted(signal)
  progress.report("encoding", 0, frames.length)
  const gif = GIFEncoder()
  const palette = buildGifPalette(frames)
  const ditherAmplitude = paletteDitherAmplitude(palette)

  // GIF delays are whole centiseconds (1/100 s). Distribute the target frame
  // duration across frames (Bresenham-style) so the average cadence matches the
  // requested fps with no rounding drift — this is what removes the playback
  // stutter versus naively truncating each delay to centiseconds.
  let emittedCs = 0
  for (let i = 0; i < frames.length; i++) {
    throwIfAborted(signal)
    const frame = frames[i]
    const { width, height } = frame
    // Ordered-dither before mapping to soften 256-color banding on image
    // backgrounds; deterministic, so it doesn't reintroduce frame-to-frame flicker.
    orderedDither(frame, ditherAmplitude)
    const index = applyPalette(frame.data, palette)
    const targetCs = Math.round(((i + 1) * frameDurationMs) / 10)
    // Never below 2cs — most viewers clamp shorter delays to ~10cs, which would
    // itself look like a stutter.
    const delayCs = Math.max(2, targetCs - emittedCs)
    emittedCs += delayCs
    gif.writeFrame(index, width, height, { palette, delay: delayCs * 10 })
    progress.report("encoding", i + 1, frames.length)
  }

  throwIfAborted(signal)
  gif.finish()
  progress.report("encoding", frames.length, frames.length)
  return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" })
}

async function tryEncodeWithMediabunny(
  ctx: CaptureCtx,
  format: "webm" | "mp4"
): Promise<Blob | null> {
  if (typeof VideoEncoder === "undefined") return null

  const preferred: VideoCodec[] =
    format === "mp4"
      ? (["avc", "hevc", "av1"] as VideoCodec[])
      : (["vp9", "vp8", "av1"] as VideoCodec[])

  const width = even(ctx.capture.width)
  const height = even(ctx.capture.height)
  const codec = await getFirstEncodableVideoCodec(preferred, {
    width,
    height,
    bitrate: QUALITY_HIGH,
  })
  if (!codec) return null

  const {
    capture,
    canvas,
    globalAspect,
    clips,
    frameCount,
    frameDurationMs,
    fps,
    progress,
    signal,
    watermark,
  } = ctx

  // Working canvas we redraw each frame into (CanvasSource samples this).
  const encodeCanvas = document.createElement("canvas")
  encodeCanvas.width = width
  encodeCanvas.height = height
  const ectx = encodeCanvas.getContext("2d")
  if (!ectx) return null

  const target = new BufferTarget()
  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  })

  const videoSource = new CanvasSource(encodeCanvas, {
    codec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, { frameRate: fps })

  let cancelled = false
  const onAbort = () => {
    cancelled = true
    void output.cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    throwIfAborted(signal)
    progress.report("capturing", 0, frameCount)
    await output.start()

    const durationSec = 1 / fps
    for (let f = 0; f < frameCount; f++) {
      if (cancelled || signal?.aborted) throw new AnimationExportAbortedError()

      const frameCanvas = await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs
      )
      // Letterbox into even-sized encode canvas if needed.
      ectx.fillStyle = "#000"
      ectx.fillRect(0, 0, width, height)
      if (!safeDrawImage(ectx, frameCanvas, 0, 0, width, height)) {
        // Keep the black letterbox frame rather than aborting the whole export.
      }
      if (watermark) drawWatermark(ectx, width, height, watermark)

      const timestamp = f / fps
      await videoSource.add(timestamp, durationSec)
      progress.report("capturing", f + 1, frameCount)
    }

    throwIfAborted(signal)
    progress.report("encoding", 0, 1)
    await output.finalize()
    progress.report("encoding", 1, 1)

    const buffer = target.buffer
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video encode produced an empty file")
    }

    const mime = format === "mp4" ? "video/mp4" : "video/webm"
    return new Blob([buffer], { type: mime })
  } catch (err) {
    if (!cancelled && output.state !== "canceled") {
      try {
        await output.cancel()
      } catch {
        /* ignore */
      }
    }
    if (
      err instanceof AnimationExportAbortedError ||
      (err instanceof Error && err.name === "AnimationExportAbortedError")
    ) {
      throw err
    }
    // Fall through to MediaRecorder for WebM only.
    console.warn("[export] WebCodecs encode failed, trying fallback:", err)
    return null
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}

async function encodeWebmMediaRecorder({
  capture,
  canvas,
  globalAspect,
  clips,
  frameCount,
  frameDurationMs,
  progress,
  signal,
  durationMs,
  fps,
  audio,
  watermark,
}: CaptureCtx & {
  durationMs: number
  audio: { src: string; volume: number } | null
}) {
  const frames: HTMLCanvasElement[] = []
  progress.report("capturing", 0, frameCount)

  for (let f = 0; f < frameCount; f++) {
    throwIfAborted(signal)
    frames.push(
      await captureStableFrame(
        capture,
        canvas,
        globalAspect,
        clips,
        f * frameDurationMs
      )
    )
    progress.report("capturing", f + 1, frameCount)
  }

  if (frames.length === 0) throw new Error("No frames captured for WebM export")
  throwIfAborted(signal)
  progress.report("encoding", 0, frames.length)

  const out = document.createElement("canvas")
  out.width = frames[0]?.width || capture.width
  out.height = frames[0]?.height || capture.height
  const octx = out.getContext("2d")
  if (!octx) throw new Error("Could not get 2d context for export")
  if (!safeDrawImage(octx, frames[0], 0, 0)) {
    octx.fillStyle = "#000"
    octx.fillRect(0, 0, out.width, out.height)
  }
  if (watermark) drawWatermark(octx, out.width, out.height, watermark)

  const stream = out.captureStream(fps)
  let audioEl: HTMLAudioElement | null = null
  let audioCtx: AudioContext | null = null
  if (audio) {
    try {
      audioEl = new Audio(audio.src)
      audioEl.volume = audio.volume
      audioCtx = new AudioContext()
      const srcNode = audioCtx.createMediaElementSource(audioEl)
      const dest = audioCtx.createMediaStreamDestination()
      srcNode.connect(dest)
      const track = dest.stream.getAudioTracks()[0]
      if (track) stream.addTrack(track)
    } catch {
      audioEl = null
    }
  }

  const mimeType = pickWebmMimeType()
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const drawFrame = (idx: number) => {
    const frame = frames[Math.max(0, Math.min(frames.length - 1, idx))]
    octx.clearRect(0, 0, out.width, out.height)
    if (!safeDrawImage(octx, frame, 0, 0)) {
      octx.fillStyle = "#000"
      octx.fillRect(0, 0, out.width, out.height)
    }
    if (watermark) drawWatermark(octx, out.width, out.height, watermark)
  }

  await new Promise<void>((resolve, reject) => {
    let rafId = 0
    let finished = false
    let lastReportedIdx = -1

    const cleanupMedia = () => {
      audioEl?.pause()
      stream.getTracks().forEach((t) => t.stop())
      void audioCtx?.close()
    }

    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(rafId)
      try {
        if (recorder.state !== "inactive") recorder.stop()
        else {
          cleanupMedia()
          resolve()
        }
      } catch (err) {
        cleanupMedia()
        reject(
          err instanceof Error ? err : new Error("Failed to stop MediaRecorder")
        )
      }
    }

    const onAbort = () => {
      finish()
      reject(new AnimationExportAbortedError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    recorder.onstop = () => {
      signal?.removeEventListener("abort", onAbort)
      cleanupMedia()
      resolve()
    }
    recorder.onerror = () => {
      signal?.removeEventListener("abort", onAbort)
      finish()
      reject(new Error("MediaRecorder failed during WebM export"))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    try {
      recorder.start(100)
    } catch (err) {
      signal?.removeEventListener("abort", onAbort)
      reject(
        err instanceof Error ? err : new Error("Failed to start MediaRecorder")
      )
      return
    }
    if (audioEl) void audioEl.play().catch(() => {})

    const start = performance.now()
    const safeDuration = Math.max(frameDurationMs, durationMs)
    const tick = (now: number) => {
      if (finished) return
      if (signal?.aborted) {
        onAbort()
        return
      }
      const elapsed = now - start
      if (elapsed >= safeDuration) {
        drawFrame(frames.length - 1)
        progress.report("encoding", frames.length, frames.length)
        setTimeout(finish, Math.max(frameDurationMs, 50))
        return
      }
      const idx = Math.min(
        frames.length - 1,
        Math.max(0, Math.floor((elapsed / 1000) * fps))
      )
      drawFrame(idx)
      if (idx !== lastReportedIdx) {
        lastReportedIdx = idx
        progress.report("encoding", idx + 1, frames.length)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  throwIfAborted(signal)
  if (chunks.length === 0) throw new Error("WebM export produced an empty file")

  return new Blob(chunks, { type: mimeType })
}
