"use client"

import * as React from "react"

import { useEditorStore } from "@/lib/editor/store"
import { useVideoRegistry } from "@/lib/editor/video-registry"

type PlayerContextValue = {
  playheadMs: number
  durationMs: number
  isPlaying: boolean
  play: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
  seek: (ms: number) => void
}

const AnimationPlayerContext = React.createContext<PlayerContextValue | null>(
  null
)

/**
 * Owns playback state for Animate mode. Playhead + isPlaying live here (not in
 * the Zustand store) so scrubbing at 60fps doesn't flood undo history. The
 * timeline bar and the on-canvas animation layer both read from this context so
 * they stay in lock-step. When the base layer is a video, the same transport
 * drives the canvas <video> (via the registry the video control bar uses), so
 * play/pause/scrub move the actual footage.
 */
export function AnimationPlayerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const durationMs = useEditorStore(
    (s) =>
      s.present.canvases.find((c) => c.id === s.present.activeCanvasId)
        ?.animation?.durationMs ?? 5000
  )
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)

  const [playheadMs, setPlayheadMs] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)

  const rafRef = React.useRef<number | null>(null)
  const startRef = React.useRef({ ts: 0, from: 0 })
  const durationRef = React.useRef(durationMs)
  React.useEffect(() => {
    durationRef.current = durationMs
  }, [durationMs])

  const activeCanvasIdRef = React.useRef(activeCanvasId)
  React.useEffect(() => {
    activeCanvasIdRef.current = activeCanvasId
  }, [activeCanvasId])

  // The active canvas's <video> element, when its base layer is a video.
  const getVideo = React.useCallback(() => {
    const id = activeCanvasIdRef.current
    return id ? (useVideoRegistry.getState().videos[id] ?? null) : null
  }, [])

  const syncVideoTo = React.useCallback(
    (ms: number) => {
      const el = getVideo()
      if (!el) return
      const seconds = ms / 1000
      el.currentTime = Number.isFinite(el.duration)
        ? Math.min(seconds, el.duration)
        : seconds
    },
    [getVideo]
  )

  const stopRaf = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const pause = React.useCallback(() => {
    stopRaf()
    setIsPlaying(false)
    getVideo()?.pause()
  }, [stopRaf, getVideo])

  const play = React.useCallback(() => {
    const total = durationRef.current
    // Restart from 0 when parked at (or past) the end.
    const from = playheadMs >= total ? 0 : playheadMs
    startRef.current = { ts: performance.now(), from }
    setIsPlaying(true)

    const video = getVideo()
    if (video) {
      syncVideoTo(from)
      void video.play().catch(() => {})
    }

    const tick = (now: number) => {
      const elapsed = now - startRef.current.ts
      const next = startRef.current.from + elapsed
      if (next >= total) {
        setPlayheadMs(total)
        stopRaf()
        setIsPlaying(false)
        getVideo()?.pause()
        return
      }
      setPlayheadMs(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [playheadMs, stopRaf, getVideo, syncVideoTo])

  const toggle = React.useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  const seek = React.useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, durationRef.current))
      setPlayheadMs(clamped)
      syncVideoTo(clamped)
      if (isPlaying) startRef.current = { ts: performance.now(), from: clamped }
    },
    [isPlaying, syncVideoTo]
  )

  const reset = React.useCallback(() => {
    pause()
    setPlayheadMs(0)
    syncVideoTo(0)
  }, [pause, syncVideoTo])

  React.useEffect(() => stopRaf, [stopRaf])

  const value = React.useMemo<PlayerContextValue>(
    () => ({
      playheadMs,
      durationMs,
      isPlaying,
      play,
      pause,
      toggle,
      reset,
      seek,
    }),
    [playheadMs, durationMs, isPlaying, play, pause, toggle, reset, seek]
  )

  return React.createElement(
    AnimationPlayerContext.Provider,
    { value },
    children
  )
}

export function useAnimationPlayer(): PlayerContextValue {
  const ctx = React.useContext(AnimationPlayerContext)
  if (!ctx) {
    throw new Error(
      "useAnimationPlayer must be used within an AnimationPlayerProvider"
    )
  }
  return ctx
}

/** Non-throwing variant for components that render both in and out of animate mode. */
export function useAnimationPlayerOptional(): PlayerContextValue | null {
  return React.useContext(AnimationPlayerContext)
}
