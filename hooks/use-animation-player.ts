"use client"

import * as React from "react"

import { useEditorStore } from "@/lib/editor/store"

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
 * they stay in lock-step.
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
  const audioMeta = useEditorStore(
    (s) =>
      s.present.canvases.find((c) => c.id === s.present.activeCanvasId)
        ?.animation?.audio ?? null
  )

  const [playheadMs, setPlayheadMs] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)

  const rafRef = React.useRef<number | null>(null)
  const startRef = React.useRef({ ts: 0, from: 0 })
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const durationRef = React.useRef(durationMs)
  React.useEffect(() => {
    durationRef.current = durationMs
  }, [durationMs])

  // Keep a single <audio> element in sync with the attached track.
  React.useEffect(() => {
    if (typeof Audio === "undefined") return
    if (!audioRef.current) audioRef.current = new Audio()
    const el = audioRef.current
    const src = audioMeta?.src ?? ""
    if (el.src !== src) el.src = src
    el.volume = audioMeta?.volume ?? 1
    el.muted = audioMeta?.muted ?? false
    return () => {
      el.pause()
    }
  }, [audioMeta?.src, audioMeta?.volume, audioMeta?.muted])

  const stopRaf = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const pause = React.useCallback(() => {
    stopRaf()
    setIsPlaying(false)
    audioRef.current?.pause()
  }, [stopRaf])

  const syncAudioTo = React.useCallback((ms: number) => {
    const el = audioRef.current
    if (!el || !el.src) return
    const seconds = ms / 1000
    if (Number.isFinite(el.duration) && seconds > el.duration) {
      el.currentTime = el.duration
    } else {
      el.currentTime = seconds
    }
  }, [])

  const play = React.useCallback(() => {
    const total = durationRef.current
    // Restart from 0 when parked at (or past) the end.
    const from = playheadMs >= total ? 0 : playheadMs
    startRef.current = { ts: performance.now(), from }
    setIsPlaying(true)

    const el = audioRef.current
    if (el && el.src && !el.muted) {
      syncAudioTo(from)
      void el.play().catch(() => {})
    }

    const tick = (now: number) => {
      const elapsed = now - startRef.current.ts
      const next = startRef.current.from + elapsed
      if (next >= total) {
        setPlayheadMs(total)
        stopRaf()
        setIsPlaying(false)
        audioRef.current?.pause()
        return
      }
      setPlayheadMs(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [playheadMs, stopRaf, syncAudioTo])

  const toggle = React.useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, pause, play])

  const seek = React.useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, durationRef.current))
      setPlayheadMs(clamped)
      syncAudioTo(clamped)
      if (isPlaying) startRef.current = { ts: performance.now(), from: clamped }
    },
    [isPlaying, syncAudioTo]
  )

  const reset = React.useCallback(() => {
    pause()
    setPlayheadMs(0)
    syncAudioTo(0)
  }, [pause, syncAudioTo])

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
