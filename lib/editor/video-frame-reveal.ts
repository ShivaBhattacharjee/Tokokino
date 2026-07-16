"use client"

/**
 * Once a frame is available for a given video src (first-frame seek or play),
 * Safari/Firefox preset thumbs and other idle posters for the same src should
 * update too — each mounts its own <video>, so paint on the main canvas
 * doesn't update them by itself.
 */

type Listener = () => void

const revealedSrcs = new Set<string>()
const inflightSrcs = new Set<string>()
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function markVideoSrcRevealed(src: string | null | undefined) {
  if (!src || revealedSrcs.has(src)) return
  revealedSrcs.add(src)
  inflightSrcs.delete(src)
  emit()
}

export function isVideoSrcRevealed(src: string | null | undefined) {
  return Boolean(src && revealedSrcs.has(src))
}

export function subscribeVideoSrcReveal(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Cheap frame paint for secondary videos (preset thumbs) after a frame is
 * already known for this src. Avoids the expensive multi-decode path on mount
 * for every thumb — one leader paints first, then siblings seek once.
 */
export function paintVideoFrame(video: HTMLVideoElement) {
  if (video.videoWidth <= 0) return
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const target = Math.min(
    0.05,
    duration > 0 ? Math.max(duration / 100, 0.001) : 0.05
  )
  try {
    // Nudge even if already near target so WebKit decodes a frame.
    video.currentTime =
      Math.abs(video.currentTime - target) < 1e-3 ? target + 0.001 : target
  } catch {
    // Ignore seek errors on detached / not-ready elements.
  }
}

function resolveVideoSrc(
  video: HTMLVideoElement,
  src?: string | null
): string | null {
  const key = (
    src ||
    video.currentSrc ||
    video.getAttribute("src") ||
    ""
  ).trim()
  return key || null
}

/**
 * Decode a single idle frame for `src` without requiring user playback.
 * Only one in-flight attempt per src (main canvas should lead; preset thumbs
 * wait for `markVideoSrcRevealed` and then paint their own elements).
 */
export function requestVideoFrameReveal(
  video: HTMLVideoElement,
  src?: string | null
): void {
  const key = resolveVideoSrc(video, src)
  if (!key || revealedSrcs.has(key) || inflightSrcs.has(key)) return

  inflightSrcs.add(key)

  let settled = false
  const finish = (ok: boolean) => {
    if (settled) return
    settled = true
    inflightSrcs.delete(key)
    if (ok) markVideoSrcRevealed(key)
  }

  const paintAndWait = () => {
    if (!video.isConnected) {
      finish(false)
      return
    }
    if (video.videoWidth <= 0) {
      finish(false)
      return
    }

    // Already have a decoded frame at a non-zero time.
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime > 0.001
    ) {
      finish(true)
      return
    }

    let settledFromFrame = false
    const onFrame = () => {
      if (settledFromFrame) return
      settledFromFrame = true
      finish(true)
    }

    const rvfc = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number
      }
    ).requestVideoFrameCallback
    if (typeof rvfc === "function") {
      rvfc.call(video, onFrame)
    } else {
      video.addEventListener("seeked", onFrame, { once: true })
    }

    // WebKit sometimes skips seeked/rVFC; don't leave inflight stuck forever.
    window.setTimeout(() => {
      if (settled) return
      finish(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    }, 2000)

    paintVideoFrame(video)
  }

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    paintAndWait()
    return
  }

  const onMeta = () => paintAndWait()
  video.addEventListener("loadedmetadata", onMeta, { once: true })

  // Preset thumbs use preload="none" so metadata never arrives unless we ask.
  if (video.preload === "none") {
    video.preload = "metadata"
  }
  try {
    // Restart load if the element was left empty (common with preload=none).
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      video.load()
    }
  } catch {
    // Ignore load() errors on detached elements.
  }

  // If metadata never arrives (bad src / aborted), free the slot for a retry.
  window.setTimeout(() => {
    if (!settled && !revealedSrcs.has(key)) finish(false)
  }, 8000)
}
