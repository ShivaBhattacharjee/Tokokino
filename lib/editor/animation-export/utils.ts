/**
 * Small, dependency-light helpers shared across the export pipeline:
 * abort handling, download, progress reporting, and mime/format lookups.
 */

import type {
  AnimationExportFormat,
  AnimationExportPhase,
  AnimationExportProgress,
} from "./types"
import { triggerAnchorDownload } from "@/lib/download"
import { getCanvasRenderedDims } from "../export"
import { resolveExportDownloadFilename } from "../export-filename"

export { AnimationExportAbortedError, throwIfAborted } from "./abort"

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  triggerAnchorDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Output pixel size for a canvas export at `targetWidth`. */
export function animationExportOutputDims(
  canvasId: string,
  targetWidth: number
): { width: number; height: number } {
  const rendered = getCanvasRenderedDims(canvasId)
  if (!rendered?.width || !rendered.height) {
    return { width: targetWidth, height: targetWidth }
  }
  const scale = targetWidth / rendered.width
  return {
    width: Math.round(rendered.width * scale),
    height: Math.round(rendered.height * scale),
  }
}

/** Filename for a video/animation download using the shared export format. */
export async function resolveAnimationDownloadFilename(opts: {
  canvasId: string
  scale: string
  targetWidth: number
  extension: string
}): Promise<string> {
  const dims = animationExportOutputDims(opts.canvasId, opts.targetWidth)
  return resolveExportDownloadFilename({
    canvasId: opts.canvasId,
    scale: opts.scale,
    width: dims.width,
    height: dims.height,
    extension: opts.extension,
  })
}

export function even(n: number) {
  const r = Math.max(2, Math.round(n))
  return r % 2 === 0 ? r : r + 1
}

/**
 * Best WebM mime type MediaRecorder can actually record, or null when the engine
 * records no WebM at all (Safari: its MediaRecorder only does MP4/H.264). Callers
 * must treat null as "WebM unsupported here" rather than defaulting to a string
 * that `new MediaRecorder` would reject with NotSupportedError.
 */
export function pickWebmMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return null
}

export function animationMimeAndExt(format: AnimationExportFormat): {
  contentType: string
  extension: string
} {
  if (format === "gif") return { contentType: "image/gif", extension: "gif" }
  if (format === "mp4") return { contentType: "video/mp4", extension: "mp4" }
  return { contentType: "video/webm", extension: "webm" }
}

/**
 * Longest a paint wait may block. `requestAnimationFrame` does not fire at all
 * in a backgrounded tab, so an unbounded wait would stall an export that the
 * user switched away from — including the one just before the download, leaving
 * a finished file that never lands. Two frames is ~32ms in the normal case, so
 * this only ever trips when rAF is genuinely paused.
 */
const MAX_PAINT_WAIT_MS = 1_000

export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, MAX_PAINT_WAIT_MS)
    requestAnimationFrame(() => {
      requestAnimationFrame(done)
    })
  })
}

type SchedulerYield = { yield?: () => Promise<void> }

/**
 * Hand the main thread back to the browser mid-export so queued input (the
 * dialog's Cancel button) and a progress repaint can actually run.
 *
 * `scheduler.yield()` resumes at the *front* of the task queue, so the export
 * doesn't lose its slot to unrelated work. The MessageChannel fallback is a
 * plain task; `setTimeout(0)` is not equivalent — it's clamped to 4ms+ once
 * nested, which is real overhead at hundreds of frames.
 */
export function yieldToUi(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerYield }).scheduler
  if (typeof scheduler?.yield === "function") {
    return scheduler.yield().catch(() => {})
  }
  if (typeof MessageChannel === "undefined") return Promise.resolve()
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

/**
 * Budgeted variant of {@link yieldToUi} for per-frame loops: yields only once
 * `budgetMs` of uninterrupted work has gone by. A frame that already takes
 * longer than the budget therefore yields every iteration, while cheap frames
 * batch up instead of paying a task hop each.
 */
export function createUiYielder(budgetMs = 40): () => Promise<void> {
  let lastYieldAt = performance.now()
  return async () => {
    if (performance.now() - lastYieldAt < budgetMs) return
    await yieldToUi()
    lastYieldAt = performance.now()
  }
}

export type ProgressReporter = {
  report: (phase: AnimationExportPhase, current: number, total: number) => void
}

/**
 * Always report progress; the UI layer throttles React updates so we can show
 * Frame X/Y without re-rendering on every single frame.
 */
export function createProgressReporter(
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
