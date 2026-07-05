"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiAddCircleLine,
  RiAddLine,
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiFileCopyLine,
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useAnimationPlayer } from "@/hooks/use-animation-player"
import { isApplePlatform } from "@/lib/editor/shortcuts"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const MIN_CLIP_MS = 200
// The hover-to-add affordance previews a fixed one-second slot, snapped to
// whole-second grid lines (e.g. 2s→3s), like Shots/Postspark.
const GHOST_SLOT_MS = 1000
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
  const duplicateAnimationClip = useEditorStore((s) => s.duplicateAnimationClip)
  const clearAnimationClips = useEditorStore((s) => s.clearAnimationClips)
  const setAnimationAudio = useEditorStore((s) => s.setAnimationAudio)
  const updateAnimationAudio = useEditorStore((s) => s.updateAnimationAudio)
  const setAnimationDuration = useEditorStore((s) => s.setAnimationDuration)

  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(
    null
  )
  // Platform-aware label for the duplicate shortcut shown in the context menu.
  const [dupShortcut, setDupShortcut] = React.useState("⌘D")
   
  React.useEffect(() => {
    setDupShortcut(isApplePlatform() ? "⌘D" : "Ctrl+D")
  }, [])
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

  // The ruler always spans the full extendable range (up to the 60s max) so the
  // whole timeline is visible/scrollable and the duration handle can be dragged
  // anywhere in one motion. Ticks past the current duration are dimmed.
  const rulerEndMs = MAX_DURATION_MS
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

  // ---- clip drag (move body / trim either edge) -------------------------
  type ClipDragMode = "move" | "trim" | "trim-start"
  const dragRef = React.useRef<{
    id: string
    mode: ClipDragMode
    grabOffsetMs: number
    startMs: number
    durationMs: number
  } | null>(null)
  // Which clip is actively being moved — drives the little "picked up" lift.
  const [draggingClipId, setDraggingClipId] = React.useState<string | null>(
    null
  )
  // Live clip list for the drag math (kept out of the drag callback's deps).
  const clipsRef = React.useRef(clips)
  React.useEffect(() => {
    clipsRef.current = clips
  }, [clips])

  const applyClipDrag = React.useCallback(
    (clientX: number) => {
      const drag = dragRef.current
      if (!drag) return
      const pointerMs = msFromClientX(clientX)
      // Neighbouring clips (everything but the one being dragged), sorted.
      const others = clipsRef.current
        .filter((c) => c.id !== drag.id)
        .sort((a, b) => a.startMs - b.startMs)

      if (drag.mode === "move") {
        // Free movement across the whole timeline so the clip can be dropped
        // before or after its neighbours. Overlap is validated on drop (see
        // onClipPointerUp) — if the release spot collides, it snaps back.
        const nextStart = Math.max(
          0,
          Math.min(durationMs - drag.durationMs, pointerMs - drag.grabOffsetMs)
        )
        updateAnimationClip(drag.id, { startMs: nextStart })
      } else if (drag.mode === "trim-start") {
        // Drag the left edge; the right edge (end) stays pinned. Can't cross
        // into the previous clip.
        const end = drag.startMs + drag.durationMs
        const prevEnd = others
          .filter((o) => o.startMs + o.durationMs <= end)
          .reduce((max, o) => Math.max(max, o.startMs + o.durationMs), 0)
        const nextStart = Math.max(
          prevEnd,
          Math.min(end - MIN_CLIP_MS, pointerMs)
        )
        updateAnimationClip(drag.id, {
          startMs: nextStart,
          durationMs: end - nextStart,
        })
      } else {
        // Trim the right edge; can't cross into the next clip.
        const nextClipStart = others
          .filter((o) => o.startMs >= drag.startMs)
          .reduce((min, o) => Math.min(min, o.startMs), durationMs)
        const nextDuration = Math.max(
          MIN_CLIP_MS,
          Math.min(nextClipStart - drag.startMs, pointerMs - drag.startMs)
        )
        updateAnimationClip(drag.id, { durationMs: nextDuration })
      }
    },
    [durationMs, msFromClientX, updateAnimationClip]
  )

  const onClipPointerDown = (
    e: React.PointerEvent,
    clip: (typeof clips)[number],
    mode: ClipDragMode
  ) => {
    // Let right-click through so the context menu can open instead of dragging.
    if (e.button !== 0) return
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
    if (mode === "move") setDraggingClipId(clip.id)
    pointerXRef.current = e.clientX
    startAutoScroll(applyClipDrag)
  }

  const onClipPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    pointerXRef.current = e.clientX
    applyClipDrag(e.clientX)
  }

  const onClipPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (drag) {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      // On a move, if the drop overlaps a neighbour, snap to the nearest free
      // spot (butt up against it) rather than bouncing all the way back — only
      // fall back to the start if nothing fits.
      if (drag.mode === "move") {
        const dur = drag.durationMs
        const maxStart = durationMs - dur
        const others = clipsRef.current.filter((c) => c.id !== drag.id)
        const dropped =
          clipsRef.current.find((c) => c.id === drag.id)?.startMs ??
          drag.startMs
        const fits = (s: number) =>
          s >= 0 &&
          s <= maxStart &&
          !others.some(
            (o) => s < o.startMs + o.durationMs && s + dur > o.startMs
          )
        if (!fits(dropped)) {
          // Candidate free positions: flush against each neighbour's edges,
          // the timeline ends, and the original spot as a last resort.
          const candidates = [drag.startMs, 0, maxStart]
          for (const o of others) {
            candidates.push(o.startMs + o.durationMs, o.startMs - dur)
          }
          const resolved =
            candidates
              .filter(fits)
              .sort(
                (a, b) => Math.abs(a - dropped) - Math.abs(b - dropped)
              )[0] ?? drag.startMs
          updateAnimationClip(drag.id, { startMs: resolved })
        }
      }
      dragRef.current = null
      setDraggingClipId(null)
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

  // ---- hover-to-add ghost on the motion lane -----------------------------
  // Cursor-following "add here" affordance, like dropping a clip in Shots or
  // Postspark. Position is written straight to the DOM node (no React re-render
  // per pointer move) so it never lags; it snaps to whole-second slots and a
  // short transform transition makes the slot-to-slot jump feel magnetic.
  const clipsRowRef = React.useRef<HTMLDivElement | null>(null)
  const ghostRef = React.useRef<HTMLDivElement | null>(null)
  const ghostStartMsRef = React.useRef(0)
  const [ghostVisible, setGhostVisible] = React.useState(false)

  const ghostWidthPx = pxFor(GHOST_SLOT_MS)

  // Continuous, cursor-following placement — the 1s slot is centered under the
  // pointer and tracks it 1:1 (no snapping, no transform easing) so it glides
  // infinitely like Shots/Postspark instead of hopping between grid cells.
  // rAF coalesces bursts of pointermove into one DOM write per frame.
  const ghostRafRef = React.useRef<number | null>(null)
  const ghostClientXRef = React.useRef(0)
  const ghostHoveringRef = React.useRef(false)
  // While a clip's right-click menu is open, suppress the add affordance so it
  // doesn't peek out from behind the menu.
  const menuOpenRef = React.useRef(false)

  const writeGhost = React.useCallback(() => {
    ghostRafRef.current = null
    const el = clipsRowRef.current
    const node = ghostRef.current
    if (!el || !node) return
    if (
      !ghostHoveringRef.current ||
      menuOpenRef.current ||
      dragRef.current ||
      scrubbingRef.current
    ) {
      setGhostVisible(false)
      return
    }
    const rect = el.getBoundingClientRect()
    const pps = pxPerSecondRef.current
    const width = (GHOST_SLOT_MS / 1000) * pps
    if (rect.width - width < 0) {
      setGhostVisible(false)
      return
    }
    const cursorMs = Math.max(
      0,
      Math.min(durationMs, ((ghostClientXRef.current - rect.left) / pps) * 1000)
    )
    // Find the free gap the cursor sits in (between clips / timeline edges).
    // Hovering over a clip → no gap → hidden.
    const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
    let gapStart = 0
    let gapEnd = durationMs
    let inGap = true
    let prevEnd = 0
    for (const c of sorted) {
      if (cursorMs < c.startMs) {
        gapStart = prevEnd
        gapEnd = c.startMs
        break
      }
      if (cursorMs <= c.startMs + c.durationMs) {
        inGap = false
        break
      }
      prevEnd = Math.max(prevEnd, c.startMs + c.durationMs)
      gapStart = prevEnd
      gapEnd = durationMs
    }
    // The 1s slot must fit in the gap; otherwise there's nowhere to drop it.
    if (!inGap || gapEnd - gapStart < GHOST_SLOT_MS) {
      setGhostVisible(false)
      return
    }
    // Center on the cursor, then clamp into the gap so it butts up against a
    // neighbouring clip instead of vanishing.
    const start = Math.max(
      gapStart,
      Math.min(gapEnd - GHOST_SLOT_MS, cursorMs - GHOST_SLOT_MS / 2)
    )
    ghostStartMsRef.current = start
    node.style.transform = `translate3d(${(start / 1000) * pps}px,0,0)`
    setGhostVisible(true)
  }, [clips, durationMs])

  const scheduleGhost = React.useCallback(() => {
    if (ghostRafRef.current == null) {
      ghostRafRef.current = requestAnimationFrame(writeGhost)
    }
  }, [writeGhost])

  const positionGhost = React.useCallback(
    (clientX: number) => {
      if (menuOpenRef.current) return
      ghostHoveringRef.current = true
      ghostClientXRef.current = clientX
      scheduleGhost()
    },
    [scheduleGhost]
  )

  // Re-place the ghost when the timeline is zoomed (pinch / ctrl+wheel): the
  // pointer may be stationary, so no move event fires, but pxPerSecond and the
  // lane width change — recompute from the last cursor position so it doesn't
  // drift out of the lane or overlap a clip.
  React.useEffect(() => {
    if (ghostHoveringRef.current) scheduleGhost()
  }, [pxPerSecond, scheduleGhost])

  React.useEffect(
    () => () => {
      if (ghostRafRef.current != null) cancelAnimationFrame(ghostRafRef.current)
    },
    []
  )

  const onClipsRowMove = (e: React.PointerEvent) => positionGhost(e.clientX)
  const onClipsRowLeave = () => {
    ghostHoveringRef.current = false
    setGhostVisible(false)
  }

  const onClipsRowClick = () => {
    if (!ghostVisible) return
    const newId = addAnimationClip(
      "hero-landing",
      undefined,
      ghostStartMsRef.current
    )
    setSelectedClipId(newId)
  }

  const duplicateClip = (id: string) => {
    const newId = duplicateAnimationClip(id)
    if (newId) setSelectedClipId(newId)
  }

  const deleteClip = (id: string) => {
    removeAnimationClip(id)
    if (selectedClipId === id) setSelectedClipId(null)
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

  // Clip shortcuts: Delete/Backspace removes the selected clip, ⌘/Ctrl+D
  // duplicates it (no copy/paste yet, so duplicate stands in for it).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedClipId) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeAnimationClip(selectedClipId)
        setSelectedClipId(null)
      } else if (
        (e.key === "d" || e.key === "D") &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault()
        const newId = duplicateAnimationClip(selectedClipId)
        if (newId) setSelectedClipId(newId)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedClipId, removeAnimationClip, duplicateAnimationClip])

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
              className="pointer-events-none absolute -top-2 bottom-0 z-40 w-[2px] -translate-x-1/2 bg-primary"
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
              className="group absolute -top-2 bottom-0 z-30 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
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
              ref={clipsRowRef}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={onClipsRowMove}
              onPointerLeave={onClipsRowLeave}
              onClick={onClipsRowClick}
              className={cn(
                "relative h-11 overflow-hidden rounded-lg border border-border/50 bg-background/40",
                ghostVisible && "cursor-copy"
              )}
              style={{ width: pxFor(durationMs) }}
            >
              {/* Cursor-following add affordance. Purely visual (the lane owns
                  the click). Position is written to `transform` directly in the
                  move handler — no React re-render, so it can't lag — and snaps
                  to whole-second slots with a magnetic transition. */}
              <div
                ref={ghostRef}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1 bottom-1 left-0 z-10 box-border flex items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-primary/60 bg-primary/10 px-1 text-[11px] font-medium text-primary backdrop-blur-sm transition-opacity duration-150 ease-out will-change-transform",
                  ghostVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ width: ghostWidthPx }}
              >
                <RiAddCircleLine className="size-4 shrink-0" />
                {ghostWidthPx >= 92 && (
                  <span className="truncate">Animation</span>
                )}
              </div>
              {clips.map((clip) => {
                const selected = clip.id === selectedClipId
                const dragging = clip.id === draggingClipId
                return (
                  <ContextMenu
                    key={clip.id}
                    onOpenChange={(open) => {
                      menuOpenRef.current = open
                      if (open) {
                        ghostHoveringRef.current = false
                        setGhostVisible(false)
                      }
                    }}
                  >
                    <ContextMenuTrigger asChild>
                      <div
                        onPointerDown={(e) =>
                          onClipPointerDown(e, clip, "move")
                        }
                        onPointerMove={onClipPointerMove}
                        onPointerUp={onClipPointerUp}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedClipId(clip.id)
                        }}
                        className={cn(
                          "group/clip absolute top-1 bottom-1 z-20 cursor-grab touch-none overflow-hidden rounded-md border bg-linear-to-b from-neutral-700/70 to-neutral-800 transition-[transform,border-color] duration-150 ease-out active:cursor-grabbing",
                          selected
                            ? "border-primary/50"
                            : "border-white/10 hover:border-white/20",
                          dragging && "z-30 border-white/25"
                        )}
                        style={{
                          left: pxFor(clip.startMs),
                          width: pxFor(clip.durationMs),
                          transform: dragging ? "translateY(-3px)" : undefined,
                        }}
                      >
                        {/* Centered mockup preview — the thing being animated. */}
                        <div className="pointer-events-none flex h-full items-center justify-center px-3">
                          {screenshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={screenshot}
                              alt=""
                              className="h-7 max-w-[64px] rounded-[5px] object-cover ring-1 ring-white/10"
                            />
                          ) : (
                            <span className="h-7 w-12 rounded-[5px] bg-white/10 ring-1 ring-white/10" />
                          )}
                        </div>

                        {/* Trim handles — a grip pill on each edge, revealed on
                            hover (image reference). Left trims the start, right
                            trims the end. */}
                        <div
                          onPointerDown={(e) =>
                            onClipPointerDown(e, clip, "trim-start")
                          }
                          onPointerMove={onClipPointerMove}
                          onPointerUp={onClipPointerUp}
                          className="absolute inset-y-0 left-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                        >
                          <span className="h-4 w-1 rounded-full bg-white/70 opacity-0 shadow transition-opacity duration-150 group-hover/clip:opacity-100" />
                        </div>
                        <div
                          onPointerDown={(e) =>
                            onClipPointerDown(e, clip, "trim")
                          }
                          onPointerMove={onClipPointerMove}
                          onPointerUp={onClipPointerUp}
                          className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                        >
                          <span className="h-4 w-1 rounded-full bg-white/70 opacity-0 shadow transition-opacity duration-150 group-hover/clip:opacity-100" />
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuItem onSelect={() => duplicateClip(clip.id)}>
                        <RiFileCopyLine />
                        Duplicate
                        <ContextMenuShortcut>{dupShortcut}</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => deleteClip(clip.id)}
                      >
                        <RiDeleteBinLine />
                        Delete
                        <ContextMenuShortcut className="text-destructive/70">
                          Del
                        </ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
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
