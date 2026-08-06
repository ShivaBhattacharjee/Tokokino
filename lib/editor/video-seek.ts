/**
 * Coalesced seeking for the canvas `<video>`.
 *
 * Scrubbing the Animate timeline asks for a seek on every pointermove, but a
 * `<video>` services one at a time — the rest queue behind a decode. On a
 * source with sparse key frames (2s is a common encoder default) that backlog
 * runs seconds deep and the canvas stops tracking the playhead at all.
 *
 * So `seek` keeps one seek in flight and remembers only the newest target:
 * intermediate positions the pointer swept past are dropped, and the element
 * settles on where the pointer actually stopped.
 *
 * Transport moves use `seekNow` instead. Queuing behind a scrub seek would let
 * playback start from a position the user already dragged away from, and jump
 * once the queue drained. The browser aborts a running seek on its own, so
 * overriding one is safe — it's a burst of them that needs the queue.
 */

// A stalled decode can swallow `seeked` outright; don't wedge the scrubber.
const SEEK_SETTLE_TIMEOUT_MS = 1500

/** Below this the seek is a no-op the browser may never answer with `seeked`. */
const SEEK_EPSILON_SEC = 1e-3

export type VideoSeeker = {
  /** Scrub: coalesced behind whatever seek is already running. */
  seek: (el: HTMLVideoElement, seconds: number) => void
  /** Transport: issue now, dropping anything queued. */
  seekNow: (el: HTMLVideoElement, seconds: number) => void
  dispose: () => void
}

export function createVideoSeeker(): VideoSeeker {
  let current: HTMLVideoElement | null = null
  let pending: number | null = null
  let timer: number | null = null
  // Non-null while a seek is in flight; also the token that tells a superseded
  // listener it no longer speaks for the seeker.
  let settle: (() => void) | null = null

  /** Stop waiting on the running seek and forget what was queued behind it. */
  const abandon = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    if (settle && current) current.removeEventListener("seeked", settle)
    settle = null
    pending = null
  }

  const issue = (el: HTMLVideoElement, seconds: number) => {
    const onSettle = () => {
      if (settle !== onSettle) return
      el.removeEventListener("seeked", onSettle)
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      settle = null
      const next = pending
      pending = null
      if (next !== null) seek(el, next)
    }

    settle = onSettle
    el.addEventListener("seeked", onSettle)
    timer = window.setTimeout(onSettle, SEEK_SETTLE_TIMEOUT_MS)
    el.currentTime = seconds
  }

  const seek = (el: HTMLVideoElement, seconds: number) => {
    // A different canvas's video: the old element's seek is no longer ours to
    // wait on.
    if (current !== el) {
      abandon()
      current = el
    }

    if (settle) {
      pending = seconds
      return
    }
    if (Math.abs(el.currentTime - seconds) < SEEK_EPSILON_SEC) return
    issue(el, seconds)
  }

  const seekNow = (el: HTMLVideoElement, seconds: number) => {
    abandon()
    current = el
    if (Math.abs(el.currentTime - seconds) < SEEK_EPSILON_SEC) return
    issue(el, seconds)
  }

  return {
    seek,
    seekNow,
    dispose() {
      abandon()
      current = null
    },
  }
}
