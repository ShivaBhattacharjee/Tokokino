/**
 * Readiness/seek helpers for the offscreen clone's `<video>` — the fallback
 * frame source used when WebCodecs decoding isn't available.
 */

import { AnimationExportAbortedError } from "../utils"

/** Wait until a (cloned, offscreen) video has decoded data ready to draw. */
export function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && Number.isFinite(video.duration)) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Could not load video for export"))
    }
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("error", onError)
    video.load()
  })
}

/**
 * Seek the clone video and wait for the frame to be ready to draw. Rejects on a
 * decode error (surfaces to the outer catch) or when the export is aborted — a
 * `"seeked"` that never fires would otherwise hang the whole render loop, and
 * the between-frames abort check can't interrupt a stuck seek.
 */
export function seekTo(
  video: HTMLVideoElement,
  timeSec: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const clamped = Math.max(0, Math.min(timeSec, (video.duration || 0) - 1e-3))
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      signal?.removeEventListener("abort", onAbort)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Video decode failed during seek"))
    }
    const onAbort = () => {
      cleanup()
      reject(new AnimationExportAbortedError())
    }
    if (signal?.aborted) {
      reject(new AnimationExportAbortedError())
      return
    }
    if (Math.abs(video.currentTime - clamped) < 1e-3) {
      resolve()
      return
    }
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)
    signal?.addEventListener("abort", onAbort, { once: true })
    video.currentTime = clamped
  })
}

/**
 * Wait until the just-seeked frame is actually decoded and drawable to a canvas.
 *
 * Safari fires `seeked` *before* the new frame is presentable to `drawImage`, so
 * a capture taken right after the seek rasterizes a black/stale frame and only
 * occasionally catches the real one — the "black video, clip glitching through"
 * symptom. `requestVideoFrameCallback` resolves only once a frame has actually
 * been presented, closing that race. Falls back to a short delay where rVFC is
 * unavailable, and is bounded by a timeout so a build that never fires it for a
 * paused seek can't hang the export.
 */
export function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }
  ).requestVideoFrameCallback
  if (typeof rvfc !== "function") {
    return new Promise((resolve) => setTimeout(resolve, 30))
  }
  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve()
    }
    // Safety net: rVFC isn't guaranteed to fire for a paused seek in every build.
    const timer = window.setTimeout(done, 100)
    rvfc.call(video, done)
  })
}
