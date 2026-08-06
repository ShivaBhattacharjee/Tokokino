/**
 * Coalesced seeking for the canvas `<video>`.
 *
 * Scrubbing the Animate timeline asks for a seek on every pointermove, but a
 * `<video>` services one at a time — the rest queue behind a decode. On a
 * source with sparse key frames (2s is a common encoder default) that backlog
 * runs seconds deep and the canvas stops tracking the playhead at all.
 *
 * So: keep one seek in flight and remember only the newest target. Intermediate
 * positions the pointer swept past are dropped, and the element always settles
 * on where the pointer actually stopped.
 */

// A stalled decode can swallow `seeked` outright; don't wedge the scrubber.
const SEEK_SETTLE_TIMEOUT_MS = 1500

/** Below this the seek is a no-op the browser may never answer with `seeked`. */
const SEEK_EPSILON_SEC = 1e-3

export type VideoSeeker = {
  seek: (el: HTMLVideoElement, seconds: number) => void
  dispose: () => void
}

export function createVideoSeeker(): VideoSeeker {
  let current: HTMLVideoElement | null = null
  let pending: number | null = null
  let inFlight = false
  let timer: number | null = null

  const clearTimer = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }

  const seek = (el: HTMLVideoElement, seconds: number) => {
    // A different canvas's video: the old element's in-flight seek is no longer
    // ours to wait on.
    if (current !== el) {
      clearTimer()
      current = el
      pending = null
      inFlight = false
    }

    if (inFlight) {
      pending = seconds
      return
    }
    if (Math.abs(el.currentTime - seconds) < SEEK_EPSILON_SEC) return

    inFlight = true

    const settle = () => {
      el.removeEventListener("seeked", settle)
      // A late answer from an element we've already moved off of — its timer
      // was dropped at the switch, and the live one isn't ours to clear.
      if (current !== el) return
      clearTimer()
      inFlight = false
      const next = pending
      pending = null
      if (next !== null) seek(el, next)
    }

    el.addEventListener("seeked", settle)
    timer = window.setTimeout(settle, SEEK_SETTLE_TIMEOUT_MS)
    el.currentTime = seconds
  }

  return {
    seek,
    dispose() {
      clearTimer()
      current = null
      pending = null
      inFlight = false
    },
  }
}
