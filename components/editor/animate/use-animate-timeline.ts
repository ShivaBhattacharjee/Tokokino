"use client"

import * as React from "react"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"

import { useAnimationPlayer } from "@/hooks/use-animation-player"
import {
  computeTicks,
  findGhostSlot,
  GHOST_SLOT_MS,
  MAX_DURATION_MS,
  MAX_PX_PER_SECOND,
  MIN_CLIP_MS,
  MIN_DURATION_MS,
  MIN_HANDLE_TRAILING_PX,
  MIN_PX_PER_SECOND,
  PX_PER_SECOND,
  RULER_TRAILING_PX,
  timelineEndFor,
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

  // The furthest clip end drives how far the track extends (with headroom).
  const lastClipEnd = clips.reduce(
    (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
    0
  )
  // Dynamic timeline length — grows with the set duration and clips instead of a
  // fixed 1-minute cap. Drives the RENDERED track (ruler width, ticks) and the
  // add-clip ghost. Drag CLAMPS use the constant MAX_DURATION_MS ceiling instead,
  // so a single drag/hold can extend far past the current end in one motion (the
  // track then grows to follow); clamping the drag to this dynamic value would
  // cap each drag at ~duration+headroom and stall when held still.
  const timelineEndMs = timelineEndFor(durationMs, lastClipEnd)

  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const setScreenshot = useEditorStore((s) => s.setScreenshot)
  const setScreenshotSlotImage = useEditorStore((s) => s.setScreenshotSlotImage)
  const addAnimationClip = useEditorStore((s) => s.addAnimationClip)
  const updateAnimationClip = useEditorStore((s) => s.updateAnimationClip)
  const moveAnimationClip = useEditorStore((s) => s.moveAnimationClip)
  const splitAnimationClip = useEditorStore((s) => s.splitAnimationClip)
  const setAnimationClipSelection = useEditorStore(
    (s) => s.setAnimationClipSelection
  )
  const removeAnimationClips = useEditorStore((s) => s.removeAnimationClips)
  const clearAnimationClipsEffects = useEditorStore(
    (s) => s.clearAnimationClipsEffects
  )
  const duplicateAnimationClips = useEditorStore(
    (s) => s.duplicateAnimationClips
  )
  const setAnimationAudio = useEditorStore((s) => s.setAnimationAudio)
  const updateAnimationAudio = useEditorStore((s) => s.updateAnimationAudio)
  const setAnimationDuration = useEditorStore((s) => s.setAnimationDuration)

  // Clip selection lives in the store so selecting a clip can load its keyframe
  // pose onto the canvas (and save the previously-open clip's edits).
  const selectedClipId = useEditorStore((s) => s.selectedAnimationClipId)
  const selectedClipIds = useEditorStore(
    useShallow((s) => s.selectedAnimationClipIds)
  )
  const selectAnimationClip = useEditorStore((s) => s.selectAnimationClip)
  // Live selection set for the pointer/keyboard callbacks (kept out of their
  // dependency lists so they stay stable).
  const selectedIdsRef = React.useRef(selectedClipIds)
  React.useEffect(() => {
    selectedIdsRef.current = selectedClipIds
  }, [selectedClipIds])
  // Platform-aware label for the duplicate shortcut shown in the context menu.
  const [dupShortcut, setDupShortcut] = React.useState("⌘D")
  const [clearEffectsShortcut, setClearEffectsShortcut] = React.useState("⌘⇧⌫")
  const [deselectShortcut, setDeselectShortcut] = React.useState("⌘⇧A")
  React.useEffect(() => {
    // Platform detection reads navigator, so it must run client-side after mount
    // to keep SSR output deterministic (avoids a hydration mismatch on the label).
    /* eslint-disable react-hooks/set-state-in-effect */
    const apple = isApplePlatform()
    setDupShortcut(apple ? "⌘D" : "Ctrl+D")
    setClearEffectsShortcut(apple ? "⌘⇧⌫" : "Ctrl+Shift+Del")
    setDeselectShortcut(apple ? "⌘⇧A" : "Ctrl+Shift+A")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
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
  // Extend the scrollable content past the dynamic end, but also guarantee a
  // minimum pixel gap to the right of the duration handle so it never jams
  // against the scroll/panel edge when zoomed out (where the time headroom is
  // only a few pixels wide).
  const contentWidth =
    Math.max(pxFor(timelineEndMs), pxFor(durationMs) + MIN_HANDLE_TRAILING_PX) +
    RULER_TRAILING_PX

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

  const dragRef = React.useRef<{
    id: string
    mode: ClipDragMode
    grabOffsetMs: number
    startMs: number
    durationMs: number
    // Was this clip already selected when the gesture began? A plain click
    // (no drag) on an already-selected clip deselects it.
    wasSelected: boolean
    // Pointer x at press + whether it has moved past the click threshold.
    downX: number
    moved: boolean
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
      if (e.button !== 0) {
        // If this clip isn't already selected, make it the sole selection so the
        // context menu acts on it. If it's part of a multi-selection, leave the
        // selection intact so the menu acts on the whole group.
        if (!selectedIdsRef.current.includes(clip.id))
          selectAnimationClip(clip.id)
        return
      }
      e.stopPropagation()
      // Razor tool active → this click cuts the clip at the pointer instead of
      // selecting/dragging it. Keep the piece under the cut (the new second half)
      // selected so a follow-up edit lands on it.
      if (razorModeRef.current) {
        const newId = splitAnimationClip(clip.id, clipMsFromClientX(e.clientX))
        if (newId) selectAnimationClip(newId)
        else toast.error("Clip is too short to cut")
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      const wasSelected = selectedClipId === clip.id
      selectAnimationClip(clip.id)
      dragRef.current = {
        id: clip.id,
        mode,
        grabOffsetMs: clipMsFromClientX(e.clientX) - clip.startMs,
        startMs: clip.startMs,
        durationMs: clip.durationMs,
        wasSelected,
        downX: e.clientX,
        moved: false,
      }
      setInteractingClipId(clip.id)
      if (mode === "move") setDraggingClipId(clip.id)
      pointerXRef.current = e.clientX
      startAutoScroll(applyClipDrag)
    },
    [
      applyClipDrag,
      clipMsFromClientX,
      startAutoScroll,
      selectAnimationClip,
      selectedClipId,
      splitAnimationClip,
    ]
  )

  const onClipPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      // Past the click threshold this is a drag, not a click — so pointer-up
      // won't treat it as a deselect tap.
      if (Math.abs(e.clientX - dragRef.current.downX) > 4)
        dragRef.current.moved = true
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
      // A plain click (no drag) on a clip that was already selected toggles it
      // off — clicking it again deselects.
      if (!drag.moved && drag.wasSelected) selectAnimationClip(null)
      dragRef.current = null
      setDraggingClipId(null)
      setInteractingClipId(null)
      stopAutoScroll()
    },
    [moveAnimationClip, stopAutoScroll, selectAnimationClip]
  )

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

  const durationDraggingRef = React.useRef(false)
  const [isDurationDragging, setIsDurationDragging] = React.useState(false)

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
  // Timestamp of the last menu close. Radix fires the item's selecting click
  // through to the clips row after the menu closes, so a right-click → "Delete"
  // would otherwise re-add a clip at the click point. We ignore row clicks for a
  // brief window after any clip menu closes to swallow that fall-through click.
  const menuClosedAtRef = React.useRef(0)

  // Marquee (rubber-band) multi-select. A drag across empty lane space draws a
  // band and selects every clip whose footprint it overlaps; a plain click (no
  // drag) still adds a clip. The band's pixel geometry drives the overlay; the
  // hovered ids drive the live highlight until the drag commits on pointer-up.
  const marqueeRef = React.useRef<{ startX: number; active: boolean } | null>(
    null
  )
  const marqueeActiveRef = React.useRef(false)
  const suppressRowClickRef = React.useRef(false)
  const [marqueeRect, setMarqueeRect] = React.useState<{
    left: number
    width: number
  } | null>(null)
  const [marqueeIds, setMarqueeIds] = React.useState<string[]>([])
  // Mirror of the hovered ids for the pointer-up commit (kept out of the up
  // handler's deps so it doesn't rebind every marquee frame).
  const marqueeIdsRef = React.useRef<string[]>([])
  // Highlighted set = the committed selection plus any clips under an in-progress
  // marquee, so the band lights clips up live before you release.
  const highlightedClipIds = React.useMemo(() => {
    if (marqueeIds.length === 0) return selectedClipIds
    return Array.from(new Set([...selectedClipIds, ...marqueeIds]))
  }, [selectedClipIds, marqueeIds])

  const applyMarquee = React.useCallback((clientX: number) => {
    const drag = marqueeRef.current
    const el = clipsRowRef.current
    if (!drag || !el) return
    const rect = el.getBoundingClientRect()
    const pps = pxPerSecondRef.current
    // No upper clamp: dragging into the dimmed post-duration region (where clips
    // can still sit, rendered faded via overflow-visible) should catch them too.
    const curX = Math.max(0, clientX - rect.left)
    const left = Math.min(drag.startX, curX)
    const right = Math.max(drag.startX, curX)
    setMarqueeRect({ left, width: right - left })
    const minMs = (left / pps) * 1000
    const maxMs = (right / pps) * 1000
    // A clip is caught when its [start, end] footprint overlaps the band.
    const ids = clipsRef.current
      .filter((c) => c.startMs <= maxMs && c.startMs + c.durationMs >= minMs)
      .map((c) => c.id)
    marqueeIdsRef.current = ids
    setMarqueeIds(ids)
  }, [])

  const writeGhost = React.useCallback(() => {
    ghostRafRef.current = null
    const el = clipsRowRef.current
    const node = ghostRef.current
    if (!el || !node) return
    if (
      !ghostHoveringRef.current ||
      menuOpenRef.current ||
      dragRef.current ||
      scrubbingRef.current ||
      // A marquee drag owns the lane — no "add clip" ghost while selecting.
      marqueeActiveRef.current ||
      // Razor tool owns the lane — no "add clip" ghost while cutting.
      razorModeRef.current
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
    const start = findGhostSlot(cursorMs, clipsRef.current, timelineEndMs)
    if (start == null) {
      setGhostVisible(false)
      return
    }
    ghostStartMsRef.current = start
    node.style.transform = `translate3d(${(start / 1000) * pps}px,0,0)`
    setGhostVisible(true)
  }, [durationMs, timelineEndMs])

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

  // Pointer-down on empty lane space starts a marquee candidate. Clips capture
  // their own pointer (and stopPropagation), so any pointerdown reaching the row
  // is on empty space. Left-button only; razor / open-menu keep their behaviour.
  const onClipsRowPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0 || razorModeRef.current || menuOpenRef.current) return
    const el = clipsRowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    marqueeRef.current = {
      startX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      active: false,
    }
    el.setPointerCapture(e.pointerId)
    pointerXRef.current = e.clientX
  }, [])

  const onClipsRowMove = React.useCallback(
    (e: React.PointerEvent) => {
      const drag = marqueeRef.current
      if (drag) {
        // Past the click threshold this becomes a marquee, not a tap-to-add.
        if (!drag.active && Math.abs(e.clientX - pointerXRef.current) <= 4) {
          // Not yet a drag — still let the add-ghost track the cursor.
          positionGhost(e.clientX)
          return
        }
        if (!drag.active) {
          drag.active = true
          marqueeActiveRef.current = true
          ghostHoveringRef.current = false
          setGhostVisible(false)
          startAutoScroll(applyMarquee)
        }
        pointerXRef.current = e.clientX
        applyMarquee(e.clientX)
        return
      }
      positionGhost(e.clientX)
    },
    [applyMarquee, positionGhost, startAutoScroll]
  )

  const onClipsRowPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const drag = marqueeRef.current
      if (!drag) return
      marqueeRef.current = null
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      if (drag.active) {
        // Commit the band's selection and swallow the click that follows so the
        // release doesn't also add a clip.
        stopAutoScroll()
        marqueeActiveRef.current = false
        suppressRowClickRef.current = true
        setAnimationClipSelection(marqueeIdsRef.current)
        setMarqueeRect(null)
        setMarqueeIds([])
      }
    },
    [setAnimationClipSelection, stopAutoScroll]
  )

  const onClipsRowLeave = React.useCallback(() => {
    ghostHoveringRef.current = false
    setGhostVisible(false)
  }, [])

  const onClipsRowClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Compute the insertion slot straight from the click position rather than
      // gating on the hover ghost. Touch devices (iPad) don't hover, so the
      // ghost never becomes visible before the tap's click fires — reading the
      // pointer position here makes tap-to-add work without a preceding hover
      // while desktop still gets the ghost preview.
      if (razorModeRef.current || menuOpenRef.current || dragRef.current) return
      // A marquee drag just finished — swallow the click it produces so the
      // release doesn't also add a clip.
      if (suppressRowClickRef.current) {
        suppressRowClickRef.current = false
        return
      }
      // Swallow the fall-through click Radix fires right after a clip's context
      // menu closes (e.g. after "Delete"), which would otherwise add a new clip.
      if (Date.now() - menuClosedAtRef.current < 350) return
      const el = clipsRowRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pps = pxPerSecondRef.current
      if (rect.width - (GHOST_SLOT_MS / 1000) * pps < 0) return
      const cursorMs = Math.max(
        0,
        Math.min(durationMs, ((e.clientX - rect.left) / pps) * 1000)
      )
      const start = findGhostSlot(cursorMs, clipsRef.current, timelineEndMs)
      if (start == null) return
      selectAnimationClip(addAnimationClip(undefined, start))
    },
    [addAnimationClip, durationMs, selectAnimationClip, timelineEndMs]
  )

  const onClipMenuOpenChange = React.useCallback((open: boolean) => {
    menuOpenRef.current = open
    if (open) {
      ghostHoveringRef.current = false
      setGhostVisible(false)
    } else {
      // Record the close so the following fall-through click on the row is
      // ignored (see menuClosedAtRef).
      menuClosedAtRef.current = Date.now()
    }
  }, [])

  const addClip = React.useCallback(
    () => selectAnimationClip(addAnimationClip()),
    [addAnimationClip, selectAnimationClip]
  )

  // The clips a context-menu / keyboard action targets: the whole selection when
  // the acted-on clip is part of it, otherwise just that clip. (Right-clicking a
  // clip already makes it the selection, so the menu always includes it.)
  const resolveTargetIds = React.useCallback((id: string) => {
    const sel = selectedIdsRef.current
    return sel.includes(id) && sel.length > 0 ? sel : [id]
  }, [])

  // After deleting clips, open the last remaining clip so the canvas falls back
  // to a valid keyframe (or deselect when none are left).
  const reselectAfterDelete = React.useCallback(
    (removed: string[]) => {
      const removedSet = new Set(removed)
      const remaining = clipsRef.current
        .filter((c) => !removedSet.has(c.id))
        .sort((a, b) => a.startMs - b.startMs)
      selectAnimationClip(
        remaining.length ? remaining[remaining.length - 1].id : null
      )
    },
    [selectAnimationClip]
  )

  const duplicateClip = React.useCallback(
    (id: string) => {
      const newIds = duplicateAnimationClips(resolveTargetIds(id))
      if (newIds.length) setAnimationClipSelection(newIds)
    },
    [duplicateAnimationClips, resolveTargetIds, setAnimationClipSelection]
  )

  // Strips the effects the targeted keyframe(s) own, reverting each to its
  // baseline so the committed canvas also drops those effects.
  const clearClipEffects = React.useCallback(
    (id: string) => clearAnimationClipsEffects(resolveTargetIds(id)),
    [clearAnimationClipsEffects, resolveTargetIds]
  )

  const deleteClip = React.useCallback(
    (id: string) => {
      const ids = resolveTargetIds(id)
      removeAnimationClips(ids)
      reselectAfterDelete(ids)
    },
    [removeAnimationClips, resolveTargetIds, reselectAfterDelete]
  )

  const deleteSelectedClip = React.useCallback(() => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    removeAnimationClips(ids)
    reselectAfterDelete(ids)
  }, [removeAnimationClips, reselectAfterDelete])

  const deselectClip = React.useCallback(
    () => selectAnimationClip(null),
    [selectAnimationClip]
  )

  // Razor (cut) tool — a persistent mode like Photoshop/After Effects, not a
  // one-shot action. While on, the timeline shows a scissor cursor and clicking
  // a clip splits it at that point. The button (and "S") toggle it. A ref mirrors
  // it so the clip pointer handlers can read it without widening their deps.
  const [razorMode, setRazorMode] = React.useState(false)
  const razorModeRef = React.useRef(false)
  React.useEffect(() => {
    // Mirror razorMode into a ref so the clip pointer handlers can read it
    // without widening their dependency lists.
    // eslint-disable-next-line react-hooks/immutability
    razorModeRef.current = razorMode
  }, [razorMode])

  // There must be at least one clip to cut. When the last clip goes away, drop
  // out of razor mode so the cursor/button don't linger with nothing to act on.
  const canRazor = clips.length > 0
  React.useEffect(() => {
    // Drop out of razor mode once the last clip is gone (nothing left to cut).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (clips.length === 0) setRazorMode(false)
  }, [clips.length])

  const toggleRazor = React.useCallback(() => {
    setRazorMode((m) => (clipsRef.current.length > 0 ? !m : false))
  }, [])

  // Leaving animate mode keeps the timeline — it's part of the saved canvas and
  // the user comes back to it. No confirmation, no discard.
  const requestExit = React.useCallback(() => {
    setIsAnimateMode(false)
  }, [setIsAnimateMode])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      // Escape first drops the razor tool (like putting the tool down); only a
      // second press leaves animate mode.
      if (razorModeRef.current) {
        setRazorMode(false)
        return
      }
      requestExit()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [requestExit])

  // Clip shortcuts: Delete/Backspace removes the selected clip(s), ⌘/Ctrl+D
  // duplicates them (no copy/paste yet, so duplicate stands in for it). Every
  // shortcut acts on the whole selection set (one clip or a marquee group).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ids = selectedIdsRef.current
      if (ids.length === 0) return
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
        // ⌘/Ctrl+Shift+Delete — clear the selected clips' effects.
        e.preventDefault()
        clearAnimationClipsEffects(ids)
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeAnimationClips(ids)
        reselectAfterDelete(ids)
      } else if (
        (e.key === "d" || e.key === "D") &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault()
        const newIds = duplicateAnimationClips(ids)
        if (newIds.length) setAnimationClipSelection(newIds)
      } else if (
        (e.key === "a" || e.key === "A") &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey
      ) {
        // ⌘/Ctrl+Shift+A — deselect (mirrors design-tool convention).
        e.preventDefault()
        selectAnimationClip(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    removeAnimationClips,
    duplicateAnimationClips,
    clearAnimationClipsEffects,
    setAnimationClipSelection,
    selectAnimationClip,
    reselectAfterDelete,
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

  // "S" toggles the razor/cut tool (video-editor convention). Ignored while
  // typing and when a modifier is held (so it never clashes with ⌘S and friends).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
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
      toggleRazor()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleRazor])

  const ticks = computeTicks(timelineEndMs, pxPerSecond)

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

  // The selected clip's data, surfaced for the floating transition toolbar.
  const selectedClip = React.useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
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
    selectedClipIds,
    highlightedClipIds,
    selectedClip,
    updateAnimationClip,
    draggingClipId,
    interactingClipId,
    clipsAnimated,
    dupShortcut,
    clearEffectsShortcut,
    deselectShortcut,

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
    onClipsRowPointerDown,
    onClipsRowPointerUp,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
    onClipMenuOpenChange,
    deselectClip,
    duplicateClip,
    clearClipEffects,
    deleteClip,

    // marquee multi-select overlay
    marqueeRect,

    // controls
    addClip,
    deleteSelectedClip,
    razorMode,
    canRazor,
    toggleRazor,
    onAudioButton,
    onPickAudio,

    // base image layers
    onLayerClick,
    onPickScreenshot,

    // exit
    requestExit,
  }
}
