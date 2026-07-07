"use client"

import * as React from "react"
import { toast } from "sonner"

import { useAnimationPlayer } from "@/hooks/use-animation-player"
import {
  computeTicks,
  findGhostSlot,
  GHOST_SLOT_MS,
  MAX_DURATION_MS,
  MAX_PX_PER_SECOND,
  MIN_CLIP_MS,
  MIN_DURATION_MS,
  MIN_PX_PER_SECOND,
  PX_PER_SECOND,
  RULER_TRAILING_PX,
} from "@/lib/editor/animation-timeline"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { isApplePlatform } from "@/lib/editor/shortcuts"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"

import type { ClipDragMode, ClipIconKey } from "./timeline-clip"

/**
 * All Animate-mode timeline interaction: zoom/scroll, clip drag + trim,
 * playhead scrubbing, duration resize, the hover-to-add ghost, audio, keyboard
 * shortcuts and the exit guard. Kept out of the component so the view stays a
 * thin render layer over this state.
 */
export function useAnimateTimeline() {
  const { playheadMs, durationMs, isPlaying, toggle, reset, seek } =
    useAnimationPlayer()

  const screenshot = useActiveCanvasField((c) => c.screenshot) ?? null
  const screenshotSlots = useActiveCanvasField((c) => c.screenshotSlots ?? [])
  const clips = useActiveCanvasField((c) => c.animation?.clips ?? [])
  const audio = useActiveCanvasField((c) => c.animation?.audio ?? null)
  // One base-layer row per image on the canvas: the main screenshot plus each
  // extra screenshot slot. Drives the stacked rows under the motion lane.
  const layers = React.useMemo(
    () => [
      { id: "main" as const, src: screenshot },
      ...screenshotSlots.map((slot) => ({ id: slot.id, src: slot.src })),
    ],
    [screenshot, screenshotSlots]
  )

  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const setScreenshot = useEditorStore((s) => s.setScreenshot)
  const setScreenshotSlotImage = useEditorStore((s) => s.setScreenshotSlotImage)
  const addAnimationClip = useEditorStore((s) => s.addAnimationClip)
  const updateAnimationClip = useEditorStore((s) => s.updateAnimationClip)
  const moveAnimationClip = useEditorStore((s) => s.moveAnimationClip)
  const removeAnimationClip = useEditorStore((s) => s.removeAnimationClip)
  const duplicateAnimationClip = useEditorStore((s) => s.duplicateAnimationClip)
  const clearAnimationClips = useEditorStore((s) => s.clearAnimationClips)
  const setAnimationAudio = useEditorStore((s) => s.setAnimationAudio)
  const updateAnimationAudio = useEditorStore((s) => s.updateAnimationAudio)
  const setAnimationDuration = useEditorStore((s) => s.setAnimationDuration)

  // Clip selection lives in the store so selecting a clip can load its keyframe
  // pose onto the canvas (and save the previously-open clip's edits).
  const selectedClipId = useEditorStore((s) => s.selectedAnimationClipId)
  const selectAnimationClip = useEditorStore((s) => s.selectAnimationClip)
  // Platform-aware label for the duplicate shortcut shown in the context menu.
  const [dupShortcut, setDupShortcut] = React.useState("⌘D")
  const [clearEffectsShortcut, setClearEffectsShortcut] = React.useState("⌘⇧⌫")
  React.useEffect(() => {
    const apple = isApplePlatform()
    setDupShortcut(apple ? "⌘D" : "Ctrl+D")
    setClearEffectsShortcut(apple ? "⌘⇧⌫" : "Ctrl+Shift+Del")
  }, [])
  const [confirmExitOpen, setConfirmExitOpen] = React.useState(false)
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const audioInputRef = React.useRef<HTMLInputElement | null>(null)
  const screenshotInputRef = React.useRef<HTMLInputElement | null>(null)

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
  // Clip slide-animations are disabled while zooming so they don't rubber-band
  // behind the scale change; re-enabled shortly after the last wheel event.
  const [clipsAnimated, setClipsAnimated] = React.useState(true)
  const zoomIdleRef = React.useRef<number | null>(null)

  const pxFor = React.useCallback(
    (ms: number) => (ms / 1000) * pxPerSecond,
    [pxPerSecond]
  )

  // The ruler always spans the full extendable range (up to the 60s max) so the
  // whole timeline is visible/scrollable and the duration handle can be dragged
  // anywhere in one motion. Ticks past the current duration are dimmed.
  const contentWidth = pxFor(MAX_DURATION_MS) + RULER_TRAILING_PX

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

  // Clip drags (move/trim) may extend past the set duration into the max range —
  // the boundary only marks playback length, not where clips can live.
  const clipMsFromClientX = React.useCallback(
    (clientX: number) =>
      Math.max(0, Math.min(MAX_DURATION_MS, rawMsFromClientX(clientX))),
    [rawMsFromClientX]
  )

  // ---- edge auto-scroll (shared by every horizontal drag) ---------------
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
        setClipsAnimated(false)
        if (zoomIdleRef.current) window.clearTimeout(zoomIdleRef.current)
        zoomIdleRef.current = window.setTimeout(
          () => setClipsAnimated(true),
          140
        )
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
    return () => {
      el.removeEventListener("wheel", onWheel)
      if (zoomIdleRef.current) window.clearTimeout(zoomIdleRef.current)
    }
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
  // Which clip is under any direct interaction (move OR trim). Its position/size
  // must track the pointer instantly, so we skip the slide animation for it.
  const [interactingClipId, setInteractingClipId] = React.useState<
    string | null
  >(null)
  // Live clip list for the drag math (kept out of the drag callback's deps).
  const clipsRef = React.useRef(clips)
  React.useEffect(() => {
    clipsRef.current = clips
  }, [clips])

  const applyClipDrag = React.useCallback(
    (clientX: number) => {
      const drag = dragRef.current
      if (!drag) return
      const pointerMs = clipMsFromClientX(clientX)
      const others = clipsRef.current
        .filter((c) => c.id !== drag.id)
        .sort((a, b) => a.startMs - b.startMs)

      if (drag.mode === "move") {
        // Free movement (may go past the duration); overlap is validated on drop.
        const nextStart = Math.max(
          0,
          Math.min(
            MAX_DURATION_MS - drag.durationMs,
            pointerMs - drag.grabOffsetMs
          )
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
        // Trim the right edge; can grow past the duration, but not into the next
        // clip or beyond the max range.
        const nextClipStart = others
          .filter((o) => o.startMs >= drag.startMs)
          .reduce((min, o) => Math.min(min, o.startMs), MAX_DURATION_MS)
        const nextDuration = Math.max(
          MIN_CLIP_MS,
          Math.min(nextClipStart - drag.startMs, pointerMs - drag.startMs)
        )
        updateAnimationClip(drag.id, { durationMs: nextDuration })
      }
    },
    [clipMsFromClientX, updateAnimationClip]
  )

  const onClipPointerDown = React.useCallback(
    (
      e: React.PointerEvent,
      clip: (typeof clips)[number],
      mode: ClipDragMode
    ) => {
      // Let right-click through so the context menu can open instead of dragging.
      if (e.button !== 0) return
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      selectAnimationClip(clip.id)
      dragRef.current = {
        id: clip.id,
        mode,
        grabOffsetMs: clipMsFromClientX(e.clientX) - clip.startMs,
        startMs: clip.startMs,
        durationMs: clip.durationMs,
      }
      setInteractingClipId(clip.id)
      if (mode === "move") setDraggingClipId(clip.id)
      pointerXRef.current = e.clientX
      startAutoScroll(applyClipDrag)
    },
    [applyClipDrag, clipMsFromClientX, startAutoScroll, selectAnimationClip]
  )

  const onClipPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      pointerXRef.current = e.clientX
      applyClipDrag(e.clientX)
    },
    [applyClipDrag]
  )

  const onClipPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      // On a move, ripple-insert the clip at the drop point: clips after it slide
      // right to open a gap, so dropping between two clips lands it there instead
      // of snapping it to the end.
      if (drag.mode === "move") {
        const dropped =
          clipsRef.current.find((c) => c.id === drag.id)?.startMs ??
          drag.startMs
        moveAnimationClip(drag.id, dropped)
      }
      dragRef.current = null
      setDraggingClipId(null)
      setInteractingClipId(null)
      stopAutoScroll()
    },
    [moveAnimationClip, stopAutoScroll]
  )

  // ---- playhead scrubbing (click + drag anywhere on the track) -----------
  const scrubbingRef = React.useRef(false)

  const applyScrub = React.useCallback(
    (clientX: number) => seek(msFromClientX(clientX)),
    [seek, msFromClientX]
  )

  const onScrubDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) return // a clip drag owns this gesture
      e.currentTarget.setPointerCapture(e.pointerId)
      scrubbingRef.current = true
      pointerXRef.current = e.clientX
      seek(msFromClientX(e.clientX))
      startAutoScroll(applyScrub)
    },
    [applyScrub, msFromClientX, seek, startAutoScroll]
  )

  const onScrubMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbingRef.current || dragRef.current) return
      pointerXRef.current = e.clientX
      seek(msFromClientX(e.clientX))
    },
    [msFromClientX, seek]
  )

  const onScrubUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbingRef.current) return
      scrubbingRef.current = false
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      stopAutoScroll()
    },
    [stopAutoScroll]
  )

  // ---- duration resize (drag the end handle) -----------------------------
  const durationDraggingRef = React.useRef(false)
  const [isDurationDragging, setIsDurationDragging] = React.useState(false)

  // The furthest clip end — informational (shown as the slider's aria min).
  // The duration is NOT forced to cover it: clips can sit past the set duration
  // (rendered faded), so the handle is free to move down to MIN_DURATION_MS.
  const lastClipEnd = clips.reduce(
    (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
    0
  )

  const applyDurationDrag = React.useCallback(
    (clientX: number) => {
      // Snap to 100ms so the readout stays tidy while dragging.
      const snapped = Math.round(rawMsFromClientX(clientX) / 100) * 100
      const next = Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, snapped))
      setAnimationDuration(next)
    },
    [rawMsFromClientX, setAnimationDuration]
  )

  const onDurationHandleDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      durationDraggingRef.current = true
      setIsDurationDragging(true)
      pointerXRef.current = e.clientX
      startAutoScroll(applyDurationDrag)
    },
    [applyDurationDrag, startAutoScroll]
  )

  const onDurationHandleMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!durationDraggingRef.current) return
      pointerXRef.current = e.clientX
      applyDurationDrag(e.clientX)
    },
    [applyDurationDrag]
  )

  const onDurationHandleUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!durationDraggingRef.current) return
      durationDraggingRef.current = false
      setIsDurationDragging(false)
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      stopAutoScroll()
    },
    [stopAutoScroll]
  )

  // ---- audio -------------------------------------------------------------
  const onPickAudio = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      const src = URL.createObjectURL(file)
      setAnimationAudio({ src, name: file.name, volume: 1, muted: false })
    },
    [setAnimationAudio]
  )

  // ---- base image layers (click a row to set/replace its image) ----------
  // Which layer the shared file input targets: "main" or a slot id.
  const pickTargetRef = React.useRef<string>("main")

  const onLayerClick = React.useCallback((target: string) => {
    pickTargetRef.current = target
    screenshotInputRef.current?.click()
  }, [])

  const onPickScreenshot = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }
      const target = pickTargetRef.current
      void readImageFileAsDataUrl(file, {
        downscaleAbove: 10 * 1024 * 1024,
        maxDimension: 2400,
      })
        .then((src) => {
          if (target === "main") setScreenshot(src)
          else setScreenshotSlotImage(target, src)
        })
        .catch(() => toast.error("Could not read image"))
    },
    [setScreenshot, setScreenshotSlotImage]
  )

  const onAudioButton = React.useCallback(() => {
    if (!audio || !audio.src) {
      audioInputRef.current?.click()
      return
    }
    updateAnimationAudio({ muted: !audio.muted })
  }, [audio, updateAnimationAudio])

  // ---- hover-to-add ghost on the motion lane -----------------------------
  // Position is written straight to the DOM node (no React re-render per pointer
  // move) so it never lags; an rAF coalesces bursts into one write per frame.
  const clipsRowRef = React.useRef<HTMLDivElement | null>(null)
  const ghostRef = React.useRef<HTMLDivElement | null>(null)
  const ghostStartMsRef = React.useRef(0)
  const [ghostVisible, setGhostVisible] = React.useState(false)
  const ghostWidthPx = pxFor(GHOST_SLOT_MS)

  const ghostRafRef = React.useRef<number | null>(null)
  const ghostClientXRef = React.useRef(0)
  const ghostHoveringRef = React.useRef(false)
  // While a clip's right-click menu is open, suppress the add affordance.
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
    if (rect.width - (GHOST_SLOT_MS / 1000) * pps < 0) {
      setGhostVisible(false)
      return
    }
    const cursorMs = Math.max(
      0,
      Math.min(durationMs, ((ghostClientXRef.current - rect.left) / pps) * 1000)
    )
    // Use the max range as the bound so the gap after the last clip extends past
    // the set duration — a slot can be added near the end even if it spills into
    // the dimmed region.
    const start = findGhostSlot(cursorMs, clipsRef.current, MAX_DURATION_MS)
    if (start == null) {
      setGhostVisible(false)
      return
    }
    ghostStartMsRef.current = start
    node.style.transform = `translate3d(${(start / 1000) * pps}px,0,0)`
    setGhostVisible(true)
  }, [durationMs])

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

  // Re-place the ghost when zoomed: the pointer may be stationary (no move
  // event), but pxPerSecond and the lane width change.
  React.useEffect(() => {
    if (ghostHoveringRef.current) scheduleGhost()
  }, [pxPerSecond, scheduleGhost])

  React.useEffect(
    () => () => {
      if (ghostRafRef.current != null) cancelAnimationFrame(ghostRafRef.current)
    },
    []
  )

  const onClipsRowMove = React.useCallback(
    (e: React.PointerEvent) => positionGhost(e.clientX),
    [positionGhost]
  )
  const onClipsRowLeave = React.useCallback(() => {
    ghostHoveringRef.current = false
    setGhostVisible(false)
  }, [])

  const onClipsRowClick = React.useCallback(() => {
    if (!ghostVisible) return
    selectAnimationClip(addAnimationClip(undefined, ghostStartMsRef.current))
  }, [addAnimationClip, ghostVisible, selectAnimationClip])

  const onClipMenuOpenChange = React.useCallback((open: boolean) => {
    menuOpenRef.current = open
    if (open) {
      ghostHoveringRef.current = false
      setGhostVisible(false)
    }
  }, [])

  const addClip = React.useCallback(
    () => selectAnimationClip(addAnimationClip()),
    [addAnimationClip, selectAnimationClip]
  )

  const duplicateClip = React.useCallback(
    (id: string) => {
      const newId = duplicateAnimationClip(id)
      if (newId) selectAnimationClip(newId)
    },
    [duplicateAnimationClip, selectAnimationClip]
  )

  // Strips the effects a keyframe owns, turning it back into a passive clip
  // that holds the previous keyframe's values — only this clip is affected.
  const clearClipEffects = React.useCallback(
    (id: string) => {
      updateAnimationClip(id, { effects: [] })
    },
    [updateAnimationClip]
  )

  // After deleting the open clip, open the last remaining clip so the canvas
  // falls back to a valid keyframe (or deselect when none are left).
  const fallbackAfterDelete = React.useCallback(
    (deletedId: string) => {
      const remaining = clips
        .filter((c) => c.id !== deletedId)
        .sort((a, b) => a.startMs - b.startMs)
      selectAnimationClip(
        remaining.length ? remaining[remaining.length - 1].id : null
      )
    },
    [clips, selectAnimationClip]
  )

  const deleteClip = React.useCallback(
    (id: string) => {
      removeAnimationClip(id)
      if (selectedClipId === id) fallbackAfterDelete(id)
    },
    [removeAnimationClip, selectedClipId, fallbackAfterDelete]
  )

  const deleteSelectedClip = React.useCallback(() => {
    if (!selectedClipId) return
    removeAnimationClip(selectedClipId)
    fallbackAfterDelete(selectedClipId)
  }, [removeAnimationClip, selectedClipId, fallbackAfterDelete])

  const selectClip = React.useCallback(
    (id: string) => selectAnimationClip(id),
    [selectAnimationClip]
  )

  // ---- exit (guarded) ----------------------------------------------------
  const hasWork = clips.length > 0 || Boolean(audio)

  const requestExit = React.useCallback(() => {
    if (hasWork) setConfirmExitOpen(true)
    else setIsAnimateMode(false)
  }, [hasWork, setIsAnimateMode])

  const confirmExit = React.useCallback(() => {
    clearAnimationClips()
    setAnimationAudio(null)
    setConfirmExitOpen(false)
    setIsAnimateMode(false)
  }, [clearAnimationClips, setAnimationAudio, setIsAnimateMode])

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
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey
      ) {
        // ⌘/Ctrl+Shift+Delete — clear this clip's effects (this clip only).
        e.preventDefault()
        updateAnimationClip(selectedClipId, { effects: [] })
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeAnimationClip(selectedClipId)
        fallbackAfterDelete(selectedClipId)
      } else if (
        (e.key === "d" || e.key === "D") &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault()
        const newId = duplicateAnimationClip(selectedClipId)
        if (newId) selectAnimationClip(newId)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    selectedClipId,
    removeAnimationClip,
    duplicateAnimationClip,
    updateAnimationClip,
    selectAnimationClip,
    fallbackAfterDelete,
  ])

  // Spacebar toggles playback (like a video editor). Ignored while typing in a
  // field; preventDefault stops page scroll and a focused button from also
  // firing, so it's always a single play/pause.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  const ticks = computeTicks(MAX_DURATION_MS, pxPerSecond)

  // Resolve a clip's bound screenshot(s) into the thumbnail(s) shown on the clip
  // — the preview alone tells the user which screenshot(s) it animates (no text
  // label). A "slot" clip shows that slot's image; "main" the main image; "all"
  // shows every image on the canvas as a small grid so it reads as "all of them".
  const resolveClipImages = React.useCallback(
    (clip: (typeof clips)[number]): string[] => {
      const target = clip.target ?? { scope: "all" as const }
      if (target.scope === "slot") {
        const slot = screenshotSlots.find((s) => s.id === target.slotId)
        // Slot deleted after the clip was made → fall back to the main image.
        const src = slot?.src ?? screenshot
        return src ? [src] : []
      }
      if (target.scope === "main") {
        return screenshot ? [screenshot] : []
      }
      // "all" → main + every slot image (skip empties). One image renders as a
      // single thumbnail; multiple render as a grid.
      return [screenshot, ...screenshotSlots.map((s) => s.src)].filter(
        (src): src is string => Boolean(src)
      )
    },
    [screenshot, screenshotSlots]
  )

  // Icons a clip shows = exactly the effects that keyframe OWNS (the ones you
  // changed while it was selected) — for the main screenshot AND slots alike.
  // This is the same owned set the on-canvas animation reads, so icons and motion
  // always agree.
  const resolveClipIcons = React.useCallback(
    (clip: (typeof clips)[number]): ClipIconKey[] => clip.effects ?? [],
    []
  )

  return {
    // playback + data
    playheadMs,
    durationMs,
    isPlaying,
    toggle,
    reset,
    screenshot,
    layers,
    clips,
    audio,

    // layout
    pxFor,
    contentWidth,
    ticks,
    lastClipEnd,

    // selection / labels
    selectedClipId,
    draggingClipId,
    interactingClipId,
    clipsAnimated,
    dupShortcut,
    clearEffectsShortcut,

    // refs
    scrollRef,
    trackRef,
    clipsRowRef,
    ghostRef,
    audioInputRef,
    screenshotInputRef,

    // clip target resolution (thumbnail images + animated-property icons)
    resolveClipImages,
    resolveClipIcons,

    // ghost
    ghostVisible,
    ghostWidthPx,

    // duration handle
    isDurationDragging,
    onDurationHandleDown,
    onDurationHandleMove,
    onDurationHandleUp,

    // scrubbing
    onScrubDown,
    onScrubMove,
    onScrubUp,

    // clip lane
    onClipsRowMove,
    onClipsRowLeave,
    onClipsRowClick,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
    onClipMenuOpenChange,
    selectClip,
    duplicateClip,
    clearClipEffects,
    deleteClip,

    // controls
    addClip,
    deleteSelectedClip,
    onAudioButton,
    onPickAudio,

    // base image layers
    onLayerClick,
    onPickScreenshot,

    // exit
    confirmExitOpen,
    setConfirmExitOpen,
    requestExit,
    confirmExit,
  }
}
