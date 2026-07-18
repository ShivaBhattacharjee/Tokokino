/**
 * Frame capture: resolve the capture strategy, apply a keyframe to the offscreen
 * clone, rasterize it to a canvas, and reconstruct portrait depth-of-field that
 * `backdrop-filter` can't render inside a `<foreignObject>`.
 */

import {
  applyAnimationFrameAtTime,
  measureBareStageDims,
} from "../apply-animation-frame"
import {
  prepareAnimationCapture,
  prepareFastAnimationCapture,
  type AnimationCapture,
} from "../export"
import type { AnimationClip, CanvasState } from "../state-types"
import { blankFrame, isDrawImageSource, snapshotFrame } from "./draw-utils"
import type { AnimationCaptureMode } from "./types"
import { waitForPaint } from "./utils"
import type { CloneVideoLayer } from "./video-layer"

/**
 * Resolve the frame-capture strategy and build it, honoring the requested mode.
 *
 * `auto` uses the fast path for every canvas — the per-frame computed-style bake
 * resolves theme and container queries, so device frames are safe too — and falls
 * back to the html-to-image path only if fast setup throws, so an export never
 * hard-fails on a capable browser.
 */
export async function acquireAnimationCapture(
  canvasId: string,
  targetWidth: number,
  mode: AnimationCaptureMode
): Promise<AnimationCapture> {
  if (mode === "legacy") {
    return prepareAnimationCapture(canvasId, targetWidth)
  }
  if (mode === "fast") {
    return prepareFastAnimationCapture(canvasId, targetWidth)
  }

  // auto
  try {
    return await prepareFastAnimationCapture(canvasId, targetWidth)
  } catch {
    return prepareAnimationCapture(canvasId, targetWidth)
  }
}

export function suppressCloneTransitions(node: HTMLElement) {
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

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// WebKit can return a structurally valid foreignObject raster while one of its
// image layers is still transparent. Keep the previous complete canvas for the
// rare retry that remains partial, rather than encoding a one-frame hole.
const lastCompleteCaptureFrame = new WeakMap<
  AnimationCapture,
  HTMLCanvasElement
>()

function hasMissingCaptureLayer(frame: HTMLCanvasElement) {
  const sample = document.createElement("canvas")
  sample.width = Math.min(64, frame.width)
  sample.height = Math.min(40, frame.height)
  const ctx = sample.getContext("2d", { willReadFrequently: true })
  if (!ctx || !sample.width || !sample.height) return false
  ctx.drawImage(frame, 0, 0, sample.width, sample.height)
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data
  let transparent = 0
  let alphaTotal = 0
  for (let i = 3; i < pixels.length; i += 4) {
    const alpha = pixels[i]
    alphaTotal += alpha
    if (alpha === 0) transparent++
  }
  const pixelCount = pixels.length / 4
  return transparent / pixelCount >= 0.04 && alphaTotal / pixelCount < 250
}

/**
 * Whether `CanvasRenderingContext2D.filter` actually blurs. WebKit accepts the
 * assignment but ignores it — `drawImage` comes back sharp — so a plain
 * `ctx.filter = "blur()"` silently no-ops the portrait DoF on Safari. Probed once
 * by blurring a 1px dark dot and checking the darkness bled to its neighbour.
 */
let canvasFilterBlurs: boolean | null = null
function supportsCanvasFilterBlur(): boolean {
  if (canvasFilterBlurs !== null) return canvasFilterBlurs
  try {
    const c = document.createElement("canvas")
    c.width = 3
    c.height = 1
    const cx = c.getContext("2d", { willReadFrequently: true })
    if (!cx) return (canvasFilterBlurs = false)
    cx.fillStyle = "#fff"
    cx.fillRect(0, 0, 3, 1)
    cx.filter = "blur(1px)"
    cx.fillStyle = "#000"
    cx.fillRect(1, 0, 1, 1)
    cx.filter = "none"
    // If blur worked the black bled into pixel 0, dropping it below white.
    canvasFilterBlurs = cx.getImageData(0, 0, 1, 1).data[0] < 250
  } catch {
    canvasFilterBlurs = false
  }
  return canvasFilterBlurs
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/**
 * One separable box-blur pass, edge-clamped, reading `src` and writing `dst`
 * (they must differ — a sliding window can't blur in place). `stride`/`count` and
 * `lineStride`/`lines` let the same code run horizontally and vertically.
 */
function boxBlurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  lines: number,
  lineStart: number,
  lineStride: number,
  count: number,
  stride: number,
  radius: number
): void {
  const norm = 1 / (radius * 2 + 1)
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride + lineStart
    for (let c = 0; c < 4; c++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const i = k < 0 ? 0 : k >= count ? count - 1 : k
        sum += src[base + i * stride + c]
      }
      for (let x = 0; x < count; x++) {
        dst[base + x * stride + c] = sum * norm
        const addI = x + radius + 1
        const subI = x - radius
        const a = addI >= count ? count - 1 : addI
        const s = subI < 0 ? 0 : subI
        sum += src[base + a * stride + c] - src[base + s * stride + c]
      }
    }
  }
}

/**
 * Blur `src` into `dstCtx`. Native canvas `filter` where it works; on WebKit a
 * real 3-pass separable box blur (a close, smooth Gaussian approximation —
 * `ctx.filter` no-ops and a downscale/upscale trick prints visible blocks). Run
 * at a capped working resolution: a heavy blur carries no fine detail, so
 * shrinking first keeps 4K/8K fast without changing the look.
 */
function blurFrameInto(
  dstCtx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  blurPx: number
): void {
  const w = src.width
  const h = src.height
  if (blurPx < 0.5) {
    dstCtx.drawImage(src, 0, 0)
    return
  }
  if (supportsCanvasFilterBlur()) {
    dstCtx.filter = `blur(${blurPx}px)`
    dstCtx.drawImage(src, 0, 0)
    dstCtx.filter = "none"
    return
  }

  const MAX_WORK_W = 1280
  const scale = Math.min(1, MAX_WORK_W / w)
  const ww = Math.max(1, Math.round(w * scale))
  const wh = Math.max(1, Math.round(h * scale))
  const work = makeCanvas(ww, wh)
  const wctx = work.getContext("2d", { willReadFrequently: true })
  if (!wctx) {
    dstCtx.drawImage(src, 0, 0)
    return
  }
  wctx.imageSmoothingEnabled = true
  wctx.imageSmoothingQuality = "high"
  wctx.drawImage(src, 0, 0, w, h, 0, 0, ww, wh)

  // CSS blur(σ) is a Gaussian of std-dev σ; three box passes of radius ≈ σ
  // approximate it well. Clamp so a 1px working buffer can't underflow.
  const radius = Math.max(
    1,
    Math.min(Math.round(blurPx * scale), (Math.min(ww, wh) >> 1) - 1)
  )
  if (radius >= 1) {
    const img = wctx.getImageData(0, 0, ww, wh)
    const a = img.data
    const b = new Uint8ClampedArray(a.length)
    for (let pass = 0; pass < 3; pass++) {
      // Horizontal: each row, pixels stride 4, rows stride ww*4.
      boxBlurPass(a, b, wh, 0, ww * 4, ww, 4, radius)
      // Vertical: each column, pixels stride ww*4, columns stride 4.
      boxBlurPass(b, a, ww, 0, 4, wh, ww * 4, radius)
    }
    wctx.putImageData(img, 0, 0)
  }

  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = "high"
  dstCtx.drawImage(work, 0, 0, ww, wh, 0, 0, w, h)
}

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
 *
 * Must run on the *finished* frame: these overlays sit at z-index 200, above the
 * media, so the blur is meant to catch the screenshot/video too — not just the
 * backdrop. Only `blur`/`stage` are tagged; the gradient portrait modes render
 * natively and are never neutralized.
 */
export function drawPortraitDepthOfField(
  frame: HTMLCanvasElement,
  node: HTMLElement
) {
  const els = node.querySelectorAll<HTMLElement>("[data-export-portrait-fx]")
  if (els.length === 0) return
  const ctx = frame.getContext("2d")
  const nodeRect = node.getBoundingClientRect()
  if (!ctx || !nodeRect.height) return
  // Geometry (box position/height) maps the clone's own layout → frame px.
  const scaleY = frame.height / nodeRect.height

  // Blur magnitude is different: the overlay's blur is `Xem` — a FIXED px size
  // that doesn't scale with the canvas. The export clone lays out larger than the
  // live editor canvas (it's sized to the export resolution), so that fixed blur
  // renders proportionally weaker on the clone than the user sees on screen — and
  // weaker still at 4K/8K. Reference the live canvas the effect was calibrated
  // against so the blur keeps the same fraction of the frame it has in the editor.
  // offsetHeight ignores the editor's zoom transform (display-only, must not leak
  // into the export). Falls back to the clone when the live canvas isn't found.
  const canvasId = node.getAttribute("data-canvas-id")
  const liveCanvas = canvasId
    ? document.querySelector<HTMLElement>(
        `[data-canvas-id="${canvasId}"]:not([data-export-scope])`
      )
    : null
  const blurScaleY =
    liveCanvas && liveCanvas.offsetHeight > 0
      ? frame.height / liveCanvas.offsetHeight
      : scaleY

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
    const blurPx = blurEm * fontSize * blurScaleY

    if (blurPx >= 0.5) {
      const layer = document.createElement("canvas")
      layer.width = frame.width
      layer.height = frame.height
      const lc = layer.getContext("2d")
      if (lc) {
        // ctx.filter blur no-ops on WebKit — use the feature-tested blur instead.
        blurFrameInto(lc, frame, blurPx)
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

export async function captureStableFrame(
  capture: AnimationCapture,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number,
  videoLayer?: CloneVideoLayer | null
): Promise<HTMLCanvasElement> {
  // Non-null only for a video canvas: paints this frame's decoded pixels into
  // the clone, which otherwise rasterizes the video's box empty.
  await videoLayer?.paint(timeMs)
  applyExportFrame(capture.node, canvas, globalAspect, clips, timeMs)
  // The fast path serializes the clone's inline styles synchronously, so it
  // normally needs no browser paint between mutation and capture. A video layer
  // is different: its PNG data URL was just swapped into an <img>, and WebKit
  // can serialize the old/transparent compositor state until the next paint.
  if (capture.needsPaint || videoLayer) await waitForPaint()
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
  let frame = snapshotFrame(raw, capture.width, capture.height)

  // A non-empty canvas is not necessarily complete on WebKit. Its foreignObject
  // capture can omit the just-swapped video image for one frame, leaving a large
  // transparent hole. Retry after paint; if it remains partial, hold the last
  // complete canvas so the encoded video stays temporally stable. This only
  // applies to video captures — a still canvas may be legitimately transparent
  // (no background, rounded corners), which must not be mistaken for a hole and
  // replaced with a stale cached frame.
  let incompleteCapture = videoLayer ? hasMissingCaptureLayer(frame) : false
  let incompleteRetries = 0
  while (incompleteCapture && incompleteRetries < 2) {
    incompleteRetries++
    await waitForPaint()
    try {
      const retryRaw = await capture.captureFrame()
      if (!isDrawImageSource(retryRaw)) continue
      const retryFrame = snapshotFrame(retryRaw, capture.width, capture.height)
      frame = retryFrame
      incompleteCapture = hasMissingCaptureLayer(frame)
    } catch {}
  }

  if (incompleteCapture) {
    const previous = lastCompleteCaptureFrame.get(capture)
    if (previous) {
      frame = snapshotFrame(previous, capture.width, capture.height)
    }
  }

  if (!incompleteCapture) {
    lastCompleteCaptureFrame.set(
      capture,
      snapshotFrame(frame, frame.width, frame.height)
    )
  }
  // Re-draw portrait blur/stage DoF (backdrop-filter can't rasterize) as content,
  // before any watermark. Reads the clone so animated crossfade opacity applies.
  // The cache above intentionally remains pre-portrait, so a fallback does not
  // apply the blur/stage treatment twice.
  drawPortraitDepthOfField(frame, capture.node)

  return frame
}
