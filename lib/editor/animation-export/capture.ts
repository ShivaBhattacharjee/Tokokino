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
import {
  exportDebugLog,
  getActiveExportDebug,
  sampleFrameStats,
} from "./export-debug"
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
  exportDebugLog("info", "capture.acquire", "resolving capture strategy", {
    mode,
    targetWidth,
    canvasId,
  })
  if (mode === "legacy") {
    const cap = await prepareAnimationCapture(canvasId, targetWidth)
    exportDebugLog("info", "capture.acquire", "using legacy html-to-image", {
      width: cap.width,
      height: cap.height,
      needsPaint: cap.needsPaint,
    })
    getActiveExportDebug()?.setMeta("captureStrategy", "legacy")
    return cap
  }
  if (mode === "fast") {
    const cap = await prepareFastAnimationCapture(canvasId, targetWidth)
    exportDebugLog("info", "capture.acquire", "using fast path", {
      width: cap.width,
      height: cap.height,
      needsPaint: cap.needsPaint,
    })
    getActiveExportDebug()?.setMeta("captureStrategy", "fast")
    return cap
  }

  // auto
  try {
    const cap = await prepareFastAnimationCapture(canvasId, targetWidth)
    exportDebugLog("info", "capture.acquire", "auto → fast path", {
      width: cap.width,
      height: cap.height,
      needsPaint: cap.needsPaint,
    })
    getActiveExportDebug()?.setMeta("captureStrategy", "auto-fast")
    return cap
  } catch (err) {
    console.warn(
      "[export] fast capture setup failed, using html-to-image:",
      err
    )
    exportDebugLog(
      "warn",
      "capture.acquire",
      "fast setup failed, falling back to legacy html-to-image",
      {
        error: err instanceof Error ? err.message : String(err),
      }
    )
    const cap = await prepareAnimationCapture(canvasId, targetWidth)
    getActiveExportDebug()?.setMeta("captureStrategy", "auto-legacy-fallback")
    return cap
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

export async function captureStableFrame(
  capture: AnimationCapture,
  canvas: CanvasState,
  globalAspect: { id: string; w: number; h: number },
  clips: AnimationClip[],
  timeMs: number,
  videoLayer?: CloneVideoLayer | null
): Promise<HTMLCanvasElement> {
  const t0 = performance.now()
  // Non-null only for a video canvas: paints this frame's decoded pixels into
  // the clone, which otherwise rasterizes the video's box empty.
  await videoLayer?.paint(timeMs)
  applyExportFrame(capture.node, canvas, globalAspect, clips, timeMs)
  // The fast path serializes the clone's inline styles synchronously, so it
  // needs no browser paint between mutation and capture. The html-to-image path
  // reads live computed styles and does.
  if (capture.needsPaint) await waitForPaint()
  let raw: unknown
  let usedBlank = false
  let retried = false
  try {
    raw = await capture.captureFrame()
  } catch (err) {
    exportDebugLog(
      "warn",
      "capture.stable",
      "captureFrame threw — returning blank frame",
      {
        timeMs,
        error: err instanceof Error ? err.message : String(err),
      }
    )
    usedBlank = true
    return blankFrame(capture.width, capture.height)
  }
  // html-to-image is flaky on some browsers — one retry after another paint.
  if (!isDrawImageSource(raw)) {
    retried = true
    if (capture.needsPaint) await waitForPaint()
    try {
      raw = await capture.captureFrame()
    } catch (err) {
      exportDebugLog(
        "warn",
        "capture.stable",
        "captureFrame retry threw — returning blank frame",
        {
          timeMs,
          error: err instanceof Error ? err.message : String(err),
        }
      )
      usedBlank = true
      return blankFrame(capture.width, capture.height)
    }
  }
  const frame = snapshotFrame(raw, capture.width, capture.height)
  // Re-draw portrait blur/stage DoF (backdrop-filter can't rasterize) as content,
  // before any watermark. Reads the clone so animated crossfade opacity applies.
  drawPortraitDepthOfField(frame, capture.node)

  const dbg = getActiveExportDebug()
  if (dbg) {
    // Approximate frame index from time for sampling throttle.
    const approxIndex = Math.max(0, Math.round(timeMs / 33.33))
    dbg.logFrameSample("capture.stable", approxIndex, 9999, frame, {
      timeMs,
      retried,
      usedBlank,
      durationMs: Math.round(performance.now() - t0),
      stats: sampleFrameStats(frame),
    })
  }
  return frame
}
