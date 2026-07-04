"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCloseLine,
  RiPauseFill,
  RiPlayFill,
  RiResetLeftLine,
  RiScissorsCutLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAnimationPlayer } from "@/hooks/use-animation-player"
import { getAnimationPreset } from "@/lib/editor/animation-presets"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const MIN_CLIP_MS = 200
// Default timeline scale in pixels per second. Zoom (trackpad pinch / ctrl+
// wheel) scales this between the bounds below; the track scrolls horizontally
// instead of compressing to fit the viewport.
const PX_PER_SECOND = 80
const MIN_PX_PER_SECOND = 24
const MAX_PX_PER_SECOND = 400
// Duration bounds for the drag-to-resize end handle.
const MIN_DURATION_MS = 1000
const MAX_DURATION_MS = 60000
// Room kept past the end handle so its label isn't clipped at the edge.
const RULER_TRAILING_PX = 64

function formatTime(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const cs = Math.floor((total % 1000) / 10)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(m)}:${pad(s)}.${pad(cs)}`
}

function formatShort(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(m)}:${pad(s)}`
}

export function AnimateBar() {
  const { playheadMs, durationMs, isPlaying, toggle, reset, seek } =
    useAnimationPlayer()

  const screenshot = useActiveCanvasField((c) => c.screenshot)
  const clips = useActiveCanvasField((c) => c.animation?.clips ?? [])
  const audio = useActiveCanvasField((c) => c.animation?.audio ?? null)

  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const addAnimationClip = useEditorStore((s) => s.addAnimationClip)
  const updateAnimationClip = useEditorStore((s) => s.updateAnimationClip)
  const removeAnimationClip = useEditorStore((s) => s.removeAnimationClip)
  const clearAnimationClips = useEditorStore((s) => s.clearAnimationClips)
  const setAnimationAudio = useEditorStore((s) => s.setAnimationAudio)
  const updateAnimationAudio = useEditorStore((s) => s.updateAnimationAudio)
  const setAnimationDuration = useEditorStore((s) => s.setAnimationDuration)

  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(
    null
  )
  const [confirmExitOpen, setConfirmExitOpen] = React.useState(false)
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const audioInputRef = React.useRef<HTMLInputElement | null>(null)

  // Timeline zoom in pixels per second. Trackpad pinch / ctrl+wheel changes it,
  // like the zoom in a real video editor. The track always scrolls horizontally.
  const [pxPerSecond, setPxPerSecond] = React.useState(PX_PER_SECOND)
  const pxPerSecondRef = React.useRef(pxPerSecond)
  React.useEffect(() => {
    pxPerSecondRef.current = pxPerSecond
  }, [pxPerSecond])
  // Scroll offset to apply after a zoom so the point under the cursor stays put
  // (contentWidth only reflects the new scale after the re-render).
  const pendingScrollRef = React.useRef<number | null>(null)

  function pxFor(ms: number) {
    return (ms / 1000) * pxPerSecond
  }

  // Show a few seconds of empty track past the end so there's room to drag the
  // duration handle rightward (and ticks that hint you can extend).
  const rulerEndMs = Math.min(MAX_DURATION_MS, durationMs + 3000)
  const contentWidth = pxFor(rulerEndMs) + RULER_TRAILING_PX

  // Raw pointer position in ms (unclamped), relative to the track's left edge.
  const rawMsFromClientX = React.useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return ((clientX - rect.left) / pxPerSecondRef.current) * 1000
  }, [])

  const msFromClientX = React.useCallback(
    (clientX: number) =>
      Math.max(0, Math.min(durationMs, rawMsFromClientX(clientX))),
    [durationMs, rawMsFromClientX]
  )

  // ---- edge auto-scroll (shared by every horizontal drag) ---------------
  // While a drag is active and the pointer nears a viewport edge, keep the
  // timeline scrolling and re-run the drag so it follows the cursor — like
  // dragging past the edge in a real editor.
  const pointerXRef = React.useRef(0)
  const autoScrollRef = React.useRef<{
    raf: number | null
    onTick: ((clientX: number) => void) | null
  }>({ raf: null, onTick: null })

  const startAutoScroll = React.useCallback(
    (onTick: (clientX: number) => void) => {
      const state = autoScrollRef.current
      state.onTick = onTick
      if (state.raf !== null) return
      const step = () => {
        const el = scrollRef.current
        const cb = state.onTick
        if (!el || !cb) {
          state.raf = null
          return
        }
        const rect = el.getBoundingClientRect()
        const EDGE = 56
        const x = pointerXRef.current
        let dx = 0
        if (x > rect.right - EDGE) dx = Math.min(30, x - (rect.right - EDGE))
        else if (x < rect.left + EDGE) dx = -Math.min(30, rect.left + EDGE - x)
        if (dx !== 0) {
          el.scrollLeft += dx
          cb(x)
        }
        state.raf = requestAnimationFrame(step)
      }
      state.raf = requestAnimationFrame(step)
    },
    []
  )

  const stopAutoScroll = React.useCallback(() => {
    if (autoScrollRef.current.raf !== null) {
      cancelAnimationFrame(autoScrollRef.current.raf)
    }
    autoScrollRef.current = { raf: null, onTick: null }
  }, [])

  React.useEffect(() => stopAutoScroll, [stopAutoScroll])

  // ---- trackpad zoom + wheel-to-scroll ----------------------------------
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Pinch / ctrl+wheel → zoom around the cursor.
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const pointerOffset = e.clientX - rect.left
        setPxPerSecond((prev) => {
          const next = Math.max(
            MIN_PX_PER_SECOND,
            Math.min(MAX_PX_PER_SECOND, prev * Math.exp(-e.deltaY * 0.0018))
          )
          if (next === prev) return prev
          const timeAtCursor = (el.scrollLeft + pointerOffset) / prev
          pendingScrollRef.current = timeAtCursor * next - pointerOffset
          return next
        })
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // Vertical wheel → horizontal scroll (there's no vertical overflow).
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // Restore the anchored scroll offset once the zoomed content width is live.
  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pendingScrollRef.current === null) return
    el.scrollLeft = Math.max(0, pendingScrollRef.current)
    pendingScrollRef.current = null
  }, [pxPerSecond])

  // Keep the playhead within the timeline — if the duration is dragged shorter
  // than the current position, snap the playhead to the new end.
  React.useEffect(() => {
    if (playheadMs > durationMs) seek(durationMs)
  }, [playheadMs, durationMs, seek])

  // ---- clip drag (move body / trim right edge) --------------------------
  const dragRef = React.useRef<{
    id: string
    mode: "move" | "trim"
    grabOffsetMs: number
    startMs: number
    durationMs: number
  } | null>(null)

  const applyClipDrag = React.useCallback(
    (clientX: number) => {
      const drag = dragRef.current
      if (!drag) return
      const pointerMs = msFromClientX(clientX)
      if (drag.mode === "move") {
        const nextStart = Math.max(
          0,
          Math.min(durationMs - drag.durationMs, pointerMs - drag.grabOffsetMs)
        )
        updateAnimationClip(drag.id, { startMs: nextStart })
      } else {
        const nextDuration = Math.max(
          MIN_CLIP_MS,
          Math.min(durationMs - drag.startMs, pointerMs - drag.startMs)
        )
        updateAnimationClip(drag.id, { durationMs: nextDuration })
      }
    },
    [durationMs, msFromClientX, updateAnimationClip]
  )

  const onClipPointerDown = (
    e: React.PointerEvent,
    clip: (typeof clips)[number],
    mode: "move" | "trim"
  ) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedClipId(clip.id)
    dragRef.current = {
      id: clip.id,
      mode,
      grabOffsetMs: msFromClientX(e.clientX) - clip.startMs,
      startMs: clip.startMs,
      durationMs: clip.durationMs,
    }
    pointerXRef.current = e.clientX
    startAutoScroll(applyClipDrag)
  }

  const onClipPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    pointerXRef.current = e.clientX
    applyClipDrag(e.clientX)
  }

  const onClipPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      dragRef.current = null
      stopAutoScroll()
    }
  }

  // ---- playhead scrubbing (click + drag anywhere on the track) -----------
  const scrubbingRef = React.useRef(false)

  const applyScrub = React.useCallback(
    (clientX: number) => seek(msFromClientX(clientX)),
    [seek, msFromClientX]
  )

  const onScrubDown = (e: React.PointerEvent) => {
    if (dragRef.current) return // a clip drag owns this gesture
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubbingRef.current = true
    pointerXRef.current = e.clientX
    seek(msFromClientX(e.clientX))
    startAutoScroll(applyScrub)
  }

  const onScrubMove = (e: React.PointerEvent) => {
    if (!scrubbingRef.current || dragRef.current) return
    pointerXRef.current = e.clientX
    seek(msFromClientX(e.clientX))
  }

  const onScrubUp = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    stopAutoScroll()
  }

  // ---- duration resize (drag the end handle) -----------------------------
  const durationDraggingRef = React.useRef(false)
  const [isDurationDragging, setIsDurationDragging] = React.useState(false)

  // Never shrink the timeline shorter than the last clip's end.
  const lastClipEnd = clips.reduce(
    (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
    0
  )
  const lastClipEndRef = React.useRef(lastClipEnd)
  React.useEffect(() => {
    lastClipEndRef.current = lastClipEnd
  }, [lastClipEnd])

  const applyDurationDrag = React.useCallback(
    (clientX: number) => {
      const min = Math.max(MIN_DURATION_MS, lastClipEndRef.current)
      // Snap to 100ms so the readout stays tidy while dragging.
      const snapped = Math.round(rawMsFromClientX(clientX) / 100) * 100
      const next = Math.max(min, Math.min(MAX_DURATION_MS, snapped))
      setAnimationDuration(next)
    },
    [rawMsFromClientX, setAnimationDuration]
  )

  const onDurationHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    durationDraggingRef.current = true
    setIsDurationDragging(true)
    pointerXRef.current = e.clientX
    startAutoScroll(applyDurationDrag)
  }

  const onDurationHandleMove = (e: React.PointerEvent) => {
    if (!durationDraggingRef.current) return
    pointerXRef.current = e.clientX
    applyDurationDrag(e.clientX)
  }

  const onDurationHandleUp = (e: React.PointerEvent) => {
    if (!durationDraggingRef.current) return
    durationDraggingRef.current = false
    setIsDurationDragging(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    stopAutoScroll()
  }

  // ---- audio -------------------------------------------------------------
  const onPickAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const src = URL.createObjectURL(file)
    setAnimationAudio({ src, name: file.name, volume: 1, muted: false })
  }

  const onAudioButton = () => {
    if (!audio || !audio.src) {
      audioInputRef.current?.click()
      return
    }
    updateAnimationAudio({ muted: !audio.muted })
  }

  const deleteSelectedClip = () => {
    if (!selectedClipId) return
    removeAnimationClip(selectedClipId)
    setSelectedClipId(null)
  }

  // ---- exit (guarded) ----------------------------------------------------
  const hasWork = clips.length > 0 || Boolean(audio)

  const requestExit = React.useCallback(() => {
    if (hasWork) setConfirmExitOpen(true)
    else setIsAnimateMode(false)
  }, [hasWork, setIsAnimateMode])

  const confirmExit = () => {
    clearAnimationClips()
    setAnimationAudio(null)
    setConfirmExitOpen(false)
    setIsAnimateMode(false)
  }

  // Esc routes through the same guard so it can't skip the confirmation.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (confirmExitOpen) return
      e.stopPropagation()
      requestExit()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [confirmExitOpen, requestExit])

  // Ruler ticks — the interval widens as you zoom out so labels never crowd.
  // Values are in seconds; ticks past the current duration are dimmed to show
  // the extendable region.
  const tickStepSec =
    [1, 2, 5, 10, 15, 30, 60].find((s) => s * pxPerSecond >= 48) ?? 60
  const tickCount = Math.floor(rulerEndMs / 1000 / tickStepSec)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStepSec)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="pointer-events-auto absolute right-3 bottom-3 left-3 z-30 rounded-2xl border border-border/70 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickAudio}
      />

      <AlertDialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave animate mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Your animation timeline{audio ? " and audio" : ""} will be
              discarded. This can be undone from the editor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Discard &amp; exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Control row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestExit}
          aria-label="Exit animate"
          className="flex size-9 cursor-pointer items-center justify-center rounded-md bg-foreground/8 text-foreground transition-colors hover:bg-foreground/15"
        >
          <RiArrowLeftLine className="size-5" />
        </button>

        <div className="mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onAudioButton}
            aria-label={audio ? (audio.muted ? "Unmute" : "Mute") : "Add music"}
            title={audio ? audio.name : "Add music"}
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors",
              audio && !audio.muted
                ? "bg-foreground/8 text-foreground hover:bg-foreground/15"
                : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
            )}
          >
            {audio && !audio.muted ? (
              <RiVolumeUpLine className="size-5" />
            ) : (
              <RiVolumeMuteLine className="size-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => addAnimationClip("hero-landing")}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground/8 px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-foreground/15"
          >
            <RiAddLine className="size-4" />
            Animation
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-9 w-24 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
          >
            {isPlaying ? (
              <RiPauseFill className="size-4" />
            ) : (
              <RiPlayFill className="size-4" />
            )}
          </button>

          <button
            type="button"
            onClick={deleteSelectedClip}
            disabled={!selectedClipId}
            aria-label="Delete selected clip"
            title="Delete selected clip"
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors",
              selectedClipId
                ? "text-foreground hover:bg-foreground/10"
                : "cursor-not-allowed text-muted-foreground/40"
            )}
          >
            <RiScissorsCutLine className="size-5" />
          </button>

          <button
            type="button"
            onClick={reset}
            aria-label="Reset"
            title="Reset playhead"
            className="flex size-9 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-foreground/10"
          >
            <RiResetLeftLine className="size-5" />
          </button>
        </div>

        <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
          {formatTime(playheadMs)} / {formatShort(durationMs)}
        </span>
      </div>

      {/* Scrollable timeline — ruler + tracks share one horizontal scroll so
          they stay aligned. */}
      <div
        ref={scrollRef}
        className="mt-3 [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative" style={{ width: contentWidth }}>
          {/* Ruler */}
          <div className="relative h-5 select-none">
            {ticks.map((t) => {
              const beyond = t * 1000 > durationMs + 1
              return (
                <div
                  key={t}
                  className={cn(
                    "absolute top-0 flex h-full flex-col items-start transition-opacity",
                    beyond && "opacity-40"
                  )}
                  style={{ left: pxFor(t * 1000) }}
                >
                  <div className="h-2 w-px bg-border/70" />
                  <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                    {formatShort(t * 1000)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Tracks + playhead */}
          <div
            ref={trackRef}
            className="relative mt-1 cursor-pointer touch-none select-none"
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
          >
            {/* Playhead — the knob is grabbable; the thin line isn't so it
                doesn't block clip interactions underneath. Position is clamped
                to the duration so it never renders past the timeline end. */}
            <div
              className="pointer-events-none absolute -top-2 z-20 h-[calc(100%+0.5rem)] w-[2px] -translate-x-1/2 bg-primary"
              style={{ left: pxFor(Math.min(playheadMs, durationMs)) }}
            >
              <div className="pointer-events-auto absolute -top-2 left-1/2 flex h-4 w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-[3px] bg-primary shadow-sm">
                <div className="h-2 w-px bg-white/70" />
              </div>
            </div>

            {/* Duration end handle — drag to lengthen/shorten the timeline.
                Default: muted bar. Hover: taller + brighter. Dragging: solid
                white. */}
            <div
              onPointerDown={onDurationHandleDown}
              onPointerMove={onDurationHandleMove}
              onPointerUp={onDurationHandleUp}
              onPointerCancel={onDurationHandleUp}
              role="slider"
              aria-label="Timeline duration"
              aria-valuemin={Math.round(
                Math.max(MIN_DURATION_MS, lastClipEnd) / 1000
              )}
              aria-valuemax={MAX_DURATION_MS / 1000}
              aria-valuenow={Math.round(durationMs / 1000)}
              className="group absolute -top-2 z-30 flex h-[calc(100%+1rem)] w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
              style={{ left: pxFor(durationMs) }}
            >
              <div
                className={cn(
                  "rounded-full transition-all duration-150",
                  isDurationDragging
                    ? "h-full w-1 bg-primary"
                    : "h-[calc(100%-1rem)] w-[3px] bg-foreground/30 group-hover:h-full group-hover:w-1 group-hover:bg-primary"
                )}
              />
            </div>

            {/* Motion clips row — spans the current duration so the end handle
                sits right at its edge. */}
            <div
              className="relative h-11 overflow-hidden rounded-lg border border-border/50 bg-background/40"
              style={{ width: pxFor(durationMs) }}
            >
              {clips.map((clip) => {
                const preset = getAnimationPreset(clip.presetId)
                const selected = clip.id === selectedClipId
                return (
                  <div
                    key={clip.id}
                    onPointerDown={(e) => onClipPointerDown(e, clip, "move")}
                    onPointerMove={onClipPointerMove}
                    onPointerUp={onClipPointerUp}
                    className={cn(
                      "absolute top-1 bottom-1 flex cursor-grab touch-none items-center overflow-hidden rounded-md border px-2 text-[11px] font-medium text-white active:cursor-grabbing",
                      selected
                        ? "border-primary ring-1 ring-primary"
                        : "border-white/10"
                    )}
                    style={{
                      left: pxFor(clip.startMs),
                      width: pxFor(clip.durationMs),
                      background:
                        "linear-gradient(135deg,#2a1620 0%,#c4364a 120%)",
                    }}
                  >
                    <span className="truncate">{preset?.name ?? "Clip"}</span>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAnimationClip(clip.id)
                        if (selectedClipId === clip.id) setSelectedClipId(null)
                      }}
                      aria-label="Delete clip"
                      className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-md bg-black/30 text-white/80 hover:bg-black/50"
                    >
                      <RiCloseLine className="size-3" />
                    </button>
                    {/* Trim handle (right edge) */}
                    <div
                      onPointerDown={(e) => onClipPointerDown(e, clip, "trim")}
                      onPointerMove={onClipPointerMove}
                      onPointerUp={onClipPointerUp}
                      className="absolute top-0 right-0 h-full w-2 cursor-ew-resize touch-none bg-white/20"
                    />
                  </div>
                )
              })}
            </div>

            {/* Locked base image row */}
            <div
              className="relative mt-1 flex h-11 items-center gap-2 overflow-hidden rounded-lg border border-border/50 bg-background/40 px-2"
              style={{ width: pxFor(durationMs) }}
            >
              {screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={screenshot}
                  alt=""
                  className="h-8 w-12 rounded object-cover"
                />
              ) : (
                <div className="h-8 w-12 rounded bg-foreground/10" />
              )}
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[11px] text-muted-foreground">
                  Mockup
                </span>
                <span className="truncate text-[13px] font-medium text-foreground">
                  Screenshot
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
