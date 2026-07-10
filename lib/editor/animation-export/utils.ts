/**
 * Small, dependency-light helpers shared across the export pipeline:
 * abort handling, download, progress reporting, and mime/format lookups.
 */

import type {
  AnimationExportFormat,
  AnimationExportPhase,
  AnimationExportProgress,
} from "./types"

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
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function even(n: number) {
  const r = Math.max(2, Math.round(n))
  return r % 2 === 0 ? r : r + 1
}

export function pickWebmMimeType(): string {
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
