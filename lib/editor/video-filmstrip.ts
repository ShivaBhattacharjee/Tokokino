"use client"

import * as React from "react"

// Filmstrip preview for a video base layer in the Animate timeline. Extraction
// is progressive — the entry appears as soon as metadata loads (duration →
// row width) and frames stream in one by one — and cached per src for the whole
// session, so reopening Animate mode shows the finished strip instantly.

export type VideoFilmstrip = {
  durationMs: number
  /** Natural frame aspect (w/h) — drives the timeline tile width. */
  aspect: number
  /** How many frames extraction is aiming for (fixed once metadata loads). */
  targetFrames: number
  frames: string[]
  done: boolean
}

// 3x the 44px track row so tiles stay sharp on retina at typical zooms.
const FRAME_HEIGHT = 132
const MIN_FRAMES = 6
const MAX_FRAMES = 32
// One sampled frame per ~3s bounds the seek+decode work on long videos.
const SECONDS_PER_FRAME = 3
// A stalled decode pipeline can swallow the seeked event entirely — give up on
// that frame instead of hanging the whole strip.
const SEEK_TIMEOUT_MS = 4000

const entries = new Map<string, VideoFilmstrip>()
const listeners = new Map<string, Set<() => void>>()
// Guards against double extraction while a run is in flight; cleared on failure
// so a later mount can retry (e.g. the video finished downloading meanwhile).
const started = new Set<string>()

function emit(src: string) {
  const set = listeners.get(src)
  if (set) for (const listener of set) listener()
}

function setEntry(src: string, entry: VideoFilmstrip) {
  entries.set(src, entry)
  emit(src)
}

function subscribeTo(src: string, listener: () => void) {
  let set = listeners.get(src)
  if (!set) {
    set = new Set()
    listeners.set(src, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(src)
  }
}

function seekTo(video: HTMLVideoElement, time: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      resolve(ok)
    }
    const onSeeked = () => finish(true)
    const onError = () => finish(false)
    const timer = window.setTimeout(() => finish(false), SEEK_TIMEOUT_MS)
    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)
    try {
      video.currentTime = time
    } catch {
      finish(false)
    }
  })
}

async function extractFilmstrip(src: string): Promise<void> {
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.crossOrigin = "anonymous"
  video.src = src

  const loaded = await new Promise<boolean>((resolve) => {
    video.addEventListener("loadedmetadata", () => resolve(true), {
      once: true,
    })
    video.addEventListener("error", () => resolve(false), { once: true })
  })
  const durationSec = video.duration
  if (!loaded || !Number.isFinite(durationSec) || durationSec <= 0) {
    started.delete(src)
    return
  }

  const targetFrames = Math.max(
    MIN_FRAMES,
    Math.min(MAX_FRAMES, Math.ceil(durationSec / SECONDS_PER_FRAME))
  )
  const aspect =
    video.videoWidth > 0 && video.videoHeight > 0
      ? video.videoWidth / video.videoHeight
      : 16 / 9
  setEntry(src, {
    durationMs: durationSec * 1000,
    aspect,
    targetFrames,
    frames: [],
    done: false,
  })

  const canvas = document.createElement("canvas")
  canvas.height = FRAME_HEIGHT
  canvas.width = Math.max(1, Math.round(FRAME_HEIGHT * aspect))
  const ctx = canvas.getContext("2d")

  if (ctx) {
    try {
      for (let i = 0; i < targetFrames; i++) {
        // Sample the middle of each tile's time span so the tile represents it.
        const ok = await seekTo(video, ((i + 0.5) / targetFrames) * durationSec)
        if (!ok || video.videoWidth <= 0) break
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frame = canvas.toDataURL("image/jpeg", 0.7)
        const prev = entries.get(src)
        if (!prev) break
        setEntry(src, { ...prev, frames: [...prev.frames, frame] })
      }
    } catch {
      // toDataURL throws on a CORS-tainted canvas — keep what we have.
    }
  }

  // Detach the src so the browser releases the decoder right away.
  video.removeAttribute("src")
  video.load()

  const entry = entries.get(src)
  if (entry && entry.frames.length > 0) {
    setEntry(src, { ...entry, done: true })
  } else {
    // Nothing usable — drop the entry so a later mount retries cleanly.
    entries.delete(src)
    started.delete(src)
    emit(src)
  }
}

/**
 * Subscribe to the (possibly still extracting) filmstrip for a video src.
 * Returns null until metadata loads; after that, frames stream into the
 * returned entry until `done`.
 */
export function useVideoFilmstrip(src: string | null): VideoFilmstrip | null {
  const subscribe = React.useCallback(
    (listener: () => void) => (src ? subscribeTo(src, listener) : () => {}),
    [src]
  )
  const getSnapshot = React.useCallback(
    () => (src ? (entries.get(src) ?? null) : null),
    [src]
  )
  const strip = React.useSyncExternalStore(subscribe, getSnapshot, () => null)

  React.useEffect(() => {
    if (!src || started.has(src) || entries.get(src)?.done) return
    started.add(src)
    void extractFilmstrip(src)
  }, [src])

  return strip
}
