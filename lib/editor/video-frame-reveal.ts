"use client"

/**
 * Once the user has played a video (or otherwise revealed a frame) for a given
 * src, Safari/Firefox preset thumbs and other idle posters for the same src
 * should update too — each mounts its own <video>, so play on the main canvas
 * doesn't paint them by itself.
 */

type Listener = () => void

const revealedSrcs = new Set<string>()
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export function markVideoSrcRevealed(src: string | null | undefined) {
  if (!src || revealedSrcs.has(src)) return
  revealedSrcs.add(src)
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
 * Cheap frame paint for secondary videos (preset thumbs) after the user already
 * played the same src once. Avoids the expensive mount-time decode path.
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
