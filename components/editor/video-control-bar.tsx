"use client"

import * as React from "react"
import {
  RiPauseFill,
  RiPlayFill,
  RiVolumeMuteFill,
  RiVolumeUpFill,
} from "@remixicon/react"

import { AnimateTriggerButton } from "@/components/editor/animate/animate-toggle"
import { Slider } from "@/components/ui/slider"
import { isVideoSrc } from "@/lib/editor/media-type"
import { useEditorStore } from "@/lib/editor/store"
import {
  applyVideoMutedToAll,
  getVideoMutedPreferenceSync,
  setVideoMutedPreference,
} from "@/lib/editor/video-mute-preference"
import { useVideoRegistry } from "@/lib/editor/video-registry"
import { cn } from "@/lib/utils"

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0")
}

/** mm:ss.cs — matches the reference scrubber readout. */
function formatCurrent(sec: number) {
  const s = Number.isFinite(sec) && sec > 0 ? sec : 0
  const cs = Math.floor((s % 1) * 100)
  return `${pad(s / 60)}:${pad(s % 60)}.${pad(cs)}`
}

/** mm:ss — total duration. */
function formatDuration(sec: number) {
  const s = Number.isFinite(sec) && sec > 0 ? sec : 0
  return `${pad(s / 60)}:${pad(s % 60)}`
}

export function VideoControlBar({ compact = false }: { compact?: boolean }) {
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const screenshot = useEditorStore(
    (s) =>
      s.present.canvases.find((c) => c.id === activeCanvasId)?.screenshot ??
      null
  )
  const el = useVideoRegistry((s) =>
    activeCanvasId ? (s.videos[activeCanvasId] ?? null) : null
  )
  const isVideo = isVideoSrc(screenshot)

  const [isPlaying, setIsPlaying] = React.useState(false)
  const [muted, setMuted] = React.useState(() => getVideoMutedPreferenceSync())
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const scrubbingRef = React.useRef(false)

  // Read/mutate the live element through the store (not the reactive hook value)
  // so playback commands don't count as mutating a hook-returned value.
  const getVideo = React.useCallback(
    () =>
      activeCanvasId
        ? (useVideoRegistry.getState().videos[activeCanvasId] ?? null)
        : null,
    [activeCanvasId]
  )

  const persistMuted = React.useCallback((next: boolean) => {
    applyVideoMutedToAll(useVideoRegistry.getState().videos, next)
    setMuted(next)
    setVideoMutedPreference(next)
  }, [])

  React.useEffect(() => {
    if (!el) return
    const syncState = () => {
      setIsPlaying(!el.paused)
      setMuted(el.muted)
      setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    }
    const onTime = () => {
      if (!scrubbingRef.current) setCurrentTime(el.currentTime)
    }
    // Defer the initial read so it lands outside the effect body (no cascade).
    const raf = requestAnimationFrame(() => {
      syncState()
      if (!scrubbingRef.current) setCurrentTime(el.currentTime)
    })
    el.addEventListener("play", syncState)
    el.addEventListener("pause", syncState)
    el.addEventListener("volumechange", syncState)
    el.addEventListener("durationchange", syncState)
    el.addEventListener("loadedmetadata", syncState)
    el.addEventListener("timeupdate", onTime)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("play", syncState)
      el.removeEventListener("pause", syncState)
      el.removeEventListener("volumechange", syncState)
      el.removeEventListener("durationchange", syncState)
      el.removeEventListener("loadedmetadata", syncState)
      el.removeEventListener("timeupdate", onTime)
    }
  }, [el])

  // Global shortcuts in the normal editor: Space toggles play/pause, M toggles
  // mute — matching what most video tools do. Registered only on the non-compact
  // bar so the two mounted instances (desktop + the hidden phone one) don't both
  // listen and cancel each other out; it's a window listener, so it still works
  // at phone widths where this instance is display:none. (Animate mode unmounts
  // this bar, so it can't clash with the timeline's own Space handler.)
  React.useEffect(() => {
    if (compact || !isVideo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        target?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      )
        return
      const v = getVideo()
      if (!v) return
      if (e.code === "Space") {
        // Let a focused button handle its own Space press (avoids double-toggle).
        if (tag === "BUTTON") return
        e.preventDefault()
        if (v.paused) void v.play().catch(() => undefined)
        else v.pause()
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault()
        persistMuted(!v.muted)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [compact, isVideo, getVideo, persistMuted])

  if (!isVideo || !el) return null

  const togglePlay = () => {
    const v = getVideo()
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }
  const toggleMute = () => {
    const v = getVideo()
    if (!v) return
    persistMuted(!v.muted)
  }
  const handleScrub = (value: number[]) => {
    scrubbingRef.current = true
    setCurrentTime(value[0] ?? 0)
  }
  const commitScrub = (value: number[]) => {
    const v = getVideo()
    const next = value[0] ?? 0
    if (v) v.currentTime = next
    setCurrentTime(next)
    scrubbingRef.current = false
  }

  const max = duration > 0 ? duration : 0

  return (
    // Row: the Play bar plus, on desktop only, the Animate trigger inline to its
    // right. On iPad the Animate trigger floats at the top instead, and phones
    // don't support animate at all — so the inline one is desktop-only (xl).
    // `compact` stretches the bar to fill its container (used on phones).
    <div
      className={cn(
        "flex items-center gap-2",
        // Non-compact bar is the iPad/desktop one; the phone gets the compact
        // bar from MobileControls instead, so hide this at phone widths.
        compact ? "w-full" : "max-md:hidden"
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center rounded-md border border-border/70 bg-popover/90 shadow-lg backdrop-blur-md",
          compact ? "w-full gap-1.5 px-1.5 py-1" : "gap-2.5 px-2 py-1.5"
        )}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary font-semibold text-white transition hover:brightness-110",
            compact ? "h-8 w-[74px] text-[12px]" : "h-9 w-[92px] text-[13px]"
          )}
        >
          {isPlaying ? (
            <RiPauseFill className="size-4" />
          ) : (
            <RiPlayFill className="size-4" />
          )}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent",
            compact ? "size-7" : "size-8"
          )}
        >
          {muted ? (
            <RiVolumeMuteFill className="size-4" />
          ) : (
            <RiVolumeUpFill className="size-4" />
          )}
        </button>

        <Slider
          aria-label="Seek"
          min={0}
          max={max}
          step={0.01}
          value={[Math.min(currentTime, max)]}
          onValueChange={handleScrub}
          onValueCommit={commitScrub}
          disabled={max <= 0}
          className={cn(compact ? "min-w-0 flex-1" : "w-40 sm:w-56")}
        />

        <span
          className={cn(
            "shrink-0 font-mono text-muted-foreground tabular-nums",
            compact ? "text-[10px]" : "text-[11px]"
          )}
        >
          {formatCurrent(currentTime)} / {formatDuration(duration)}
        </span>
      </div>

      {/* Desktop only: on iPad/phone the Animate trigger lives elsewhere.
          self-stretch + stretch make it match the Play bar's exact height. */}
      <div className="hidden self-stretch xl:flex">
        <AnimateTriggerButton stretch />
      </div>
    </div>
  )
}
