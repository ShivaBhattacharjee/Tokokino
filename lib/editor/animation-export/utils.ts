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

export class AnimationExportAbortedError extends Error {
  constructor(message = "Export cancelled") {
    super(message)
    this.name = "AnimationExportAbortedError"
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AnimationExportAbortedError()
}

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

export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
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
