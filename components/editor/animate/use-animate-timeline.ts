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
  resolveRippleDrop,
  timelineEndFor,
} from "@/lib/editor/animation-timeline"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import {
  createVideoObjectUrl,
  isVideoFile,
  isVideoSrc,
  VIDEO_SIZE_LIMIT,
  videoElementHasAudio,
} from "@/lib/editor/media-type"
import { isApplePlatform } from "@/lib/editor/shortcuts"
import { fullPageCaptureMediaStyle } from "@/lib/editor/full-page-capture"
import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"
import { useVideoFilmstrip } from "@/lib/editor/video-filmstrip"
import {
  applyVideoMutedToAll,
  getVideoMutedPreferenceSync,
  setVideoMutedPreference,
} from "@/lib/editor/video-mute-preference"
import { useVideoRegistry } from "@/lib/editor/video-registry"

import type { ClipDragMode, ClipIconKey, ClipThumb } from "./timeline-clip"
import type { VideoTrimDragMode } from "./timeline-video-clip"

export function useAnimateTimeline() {
  const { playheadMs, durationMs, isPlaying, toggle, reset, seek } =
    useAnimationPlayer()

  const screenshot = useActiveCanvasField((c) => c.screenshot) ?? null
  const fullPageCapture = useActiveCanvasField((c) => c.fullPageCapture)
  const screenshotSlots = useActiveCanvasField((c) => c.screenshotSlots ?? [])
  const clips = useActiveCanvasField((c) => c.animation?.clips ?? [])
  const videoClips = useActiveCanvasField((c) => c.videoClips ?? null)

  const mainIsVideo = isVideoSrc(screenshot)
  const mainFilmstrip = useVideoFilmstrip(mainIsVideo ? screenshot : null)
  const videoSourceDurationMs = mainFilmstrip?.durationMs ?? durationMs
  const resolvedVideoClips = React.useMemo(() => {
    const source = videoClips?.length
      ? videoClips
      : [{ id: "video-main", timelineStartMs: 0, startMs: 0, endMs: null }]
    return source
      .map((clip) => {
        const startMs = Math.max(
          0,
          Math.min(clip.startMs, videoSourceDurationMs)
        )
        const endMs = Math.max(
          startMs,
          Math.min(clip.endMs ?? videoSourceDurationMs, videoSourceDurationMs)
        )
        return {
          ...clip,
          timelineStartMs: Math.max(0, clip.timelineStartMs ?? clip.startMs),
          startMs,
          endMs,
        }
      })
      .filter((clip) => clip.endMs - clip.startMs >= MIN_CLIP_MS)
  }, [videoClips, videoSourceDurationMs])

  const mainObjectPosition = fullPageCaptureMediaStyle(fullPageCapture)
    ?.objectPosition as string | undefined

  const layers = React.useMemo(
    () => [
      {
        id: "main" as const,
        src: screenshot,
        isVideo: mainIsVideo,
        filmstrip: mainIsVideo ? mainFilmstrip : null,
        videoClips: mainIsVideo ? resolvedVideoClips : [],
        // Keep timeline thumbs in sync with canvas full-page crop.
        objectPosition: mainIsVideo ? undefined : mainObjectPosition,
      },
      ...screenshotSlots.map((slot) => ({
        id: slot.id,
        src: slot.src,
        isVideo: false,
        filmstrip: null,
        videoClips: [] as typeof resolvedVideoClips,
        objectPosition: fullPageCaptureMediaStyle(slot.fullPageCapture)
          ?.objectPosition as string | undefined,
      })),
    ],
    [
      screenshot,
      screenshotSlots,
      mainIsVideo,
      mainFilmstrip,
      resolvedVideoClips,
      mainObjectPosition,
    ]
  )

  const lastClipEnd = clips.reduce(
    (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
    mainIsVideo
      ? resolvedVideoClips.reduce(
          (max, clip) =>
            Math.max(max, clip.timelineStartMs + clip.endMs - clip.startMs),
          0
        )
      : 0
  )

  const timelineEndMs = timelineEndFor(durationMs, lastClipEnd)

  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const setScreenshot = useEditorStore((s) => s.setScreenshot)
  const updateVideoClip = useEditorStore((s) => s.updateVideoClip)
  const splitVideoClip = useEditorStore((s) => s.splitVideoClip)
  const duplicateVideoClip = useEditorStore((s) => s.duplicateVideoClip)
  const removeVideoClips = useEditorStore((s) => s.removeVideoClips)
  const setScreenshotSlotImage = useEditorStore((s) => s.setScreenshotSlotImage)
  const addAnimationClip = useEditorStore((s) => s.addAnimationClip)
  const updateAnimationClip = useEditorStore((s) => s.updateAnimationClip)
  const moveAnimationClip = useEditorStore((s) => s.moveAnimationClip)
  const splitAnimationClip = useEditorStore((s) => s.splitAnimationClip)
  const setAnimationClipSelectionRaw = useEditorStore(
    (s) => s.setAnimationClipSelection
  )
  const removeAnimationClips = useEditorStore((s) => s.removeAnimationClips)
  const clearAnimationClipsEffects = useEditorStore(
    (s) => s.clearAnimationClipsEffects
  )
  const duplicateAnimationClips = useEditorStore(
    (s) => s.duplicateAnimationClips
  )
  const setAnimationDuration = useEditorStore((s) => s.setAnimationDuration)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)

  const appliedVideoDurationRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const videoDurationMs = mainFilmstrip?.durationMs
    if (!mainIsVideo || !screenshot || !videoDurationMs) return
    if (appliedVideoDurationRef.current === screenshot) return
    if (durationMs !== 5000) return
    appliedVideoDurationRef.current = screenshot
    setAnimationDuration(
      Math.max(
        MIN_DURATION_MS,
        Math.min(MAX_DURATION_MS, Math.round(videoDurationMs / 100) * 100)
      )
    )
  }, [mainIsVideo, screenshot, mainFilmstrip, durationMs, setAnimationDuration])

  const selectedClipId = useEditorStore((s) => s.selectedAnimationClipId)
  const selectedClipIds = useEditorStore(
    useShallow((s) => s.selectedAnimationClipIds)
  )
  const selectAnimationClipRaw = useEditorStore((s) => s.selectAnimationClip)
  const [selectedVideoClipIds, setSelectedVideoClipIds] = React.useState<
    string[]
  >([])
  const selectedVideoClipId = selectedVideoClipIds.at(-1) ?? null
  const videoSelected = selectedVideoClipIds.length > 0

  // Clip and video selection are mutually exclusive. `videoSelected` wins in the
  // toolbar and the Delete key handler, so a video left selected underneath a
  // freshly picked clip both hides the clip's transition control and points
  // delete at the video. Picking a video already clears the clip selection;
  // these mirror that for the other direction, across every selection path.
  const selectAnimationClip = React.useCallback(
    (id: string | null, canvasId?: string) => {
      if (id) setSelectedVideoClipIds([])
      selectAnimationClipRaw(id, canvasId)
    },
    [selectAnimationClipRaw, setSelectedVideoClipIds]
  )
  const setAnimationClipSelection = React.useCallback(
    (ids: string[], canvasId?: string) => {
      if (ids.length) setSelectedVideoClipIds([])
      setAnimationClipSelectionRaw(ids, canvasId)
    },
    [setAnimationClipSelectionRaw, setSelectedVideoClipIds]
  )
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!mainIsVideo) {
      if (selectedVideoClipIds.length > 0) setSelectedVideoClipIds([])
      return
    }
    const validIds = selectedVideoClipIds.filter((id) =>
      resolvedVideoClips.some((clip) => clip.id === id)
    )
    if (validIds.length !== selectedVideoClipIds.length) {
      setSelectedVideoClipIds(validIds)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mainIsVideo, resolvedVideoClips, selectedVideoClipIds])
  const selectedIdsRef = React.useRef(selectedClipIds)
  React.useEffect(() => {
    selectedIdsRef.current = selectedClipIds
  }, [selectedClipIds])

  const [dupShortcut, setDupShortcut] = React.useState("⌘D")
  const [clearEffectsShortcut, setClearEffectsShortcut] = React.useState("⌘⇧⌫")
  const [deselectShortcut, setDeselectShortcut] = React.useState("⌘⇧A")
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const apple = isApplePlatform()
    setDupShortcut(apple ? "⌘D" : "Ctrl+D")
    setClearEffectsShortcut(apple ? "⌘⇧⌫" : "Ctrl+Shift+Del")
    setDeselectShortcut(apple ? "⌘⇧A" : "Ctrl+Shift+A")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const screenshotInputRef = React.useRef<HTMLInputElement | null>(null)

  const [pxPerSecond, setPxPerSecond] = React.useState(PX_PER_SECOND)
  const pxPerSecondRef = React.useRef(pxPerSecond)
  React.useEffect(() => {
    pxPerSecondRef.current = pxPerSecond
  }, [pxPerSecond])

  const pendingScrollRef = React.useRef<number | null>(null)

  const [clipsAnimated, setClipsAnimated] = React.useState(true)
  const zoomIdleRef = React.useRef<number | null>(null)

  const pxFor = React.useCallback(
    (ms: number) => (ms / 1000) * pxPerSecond,
    [pxPerSecond]
  )

  const contentWidth =
    Math.max(pxFor(timelineEndMs), pxFor(durationMs) + MIN_HANDLE_TRAILING_PX) +
    RULER_TRAILING_PX

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

  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pendingScrollRef.current === null) return
    el.scrollLeft = Math.max(0, pendingScrollRef.current)
    pendingScrollRef.current = null
  }, [pxPerSecond])

  React.useEffect(() => {
    if (playheadMs > durationMs) seek(durationMs)
  }, [playheadMs, durationMs, seek])

  const dragRef = React.useRef<{
    id: string
    mode: ClipDragMode
    grabOffsetMs: number
    startMs: number
    durationMs: number
    wasSelected: boolean
    downX: number
    moved: boolean
  } | null>(null)

  const [draggingClipId, setDraggingClipId] = React.useState<string | null>(
    null
  )

  const [interactingClipId, setInteractingClipId] = React.useState<
    string | null
  >(null)

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
        const nextStart = Math.max(
          0,
          Math.min(
            MAX_DURATION_MS - drag.durationMs,
            pointerMs - drag.grabOffsetMs
          )
        )
        updateAnimationClip(drag.id, { startMs: nextStart })
      } else if (drag.mode === "trim-start") {
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
      if (e.button !== 0) {
        if (!selectedIdsRef.current.includes(clip.id))
          selectAnimationClip(clip.id)
        return
      }
      e.stopPropagation()

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

      if (drag.mode === "move") {
        const dropped =
          clipsRef.current.find((c) => c.id === drag.id)?.startMs ??
          drag.startMs
        moveAnimationClip(drag.id, dropped)
      }

      if (!drag.moved && drag.wasSelected) selectAnimationClip(null)
      dragRef.current = null
      setDraggingClipId(null)
      setInteractingClipId(null)
      stopAutoScroll()
    },
    [moveAnimationClip, stopAutoScroll, selectAnimationClip]
  )

  // Declared before the video row handlers below — they guard on it so a
  // menu-item press bubbling up through the portal can't start a marquee/drag.
  const menuOpenRef = React.useRef(false)
  const menuClosedAtRef = React.useRef(0)

  const videoDragRef = React.useRef<{
    id: string
    mode: VideoTrimDragMode
    timelineStartMs: number
    startMs: number
    endMs: number
    grabOffsetMs: number
    movingClips: { id: string; timelineStartMs: number }[]
    captureTarget: Element
    pointerId: number
    wasSelected: boolean
    downX: number
    moved: boolean
  } | null>(null)
  const [trimmingVideo, setTrimmingVideo] = React.useState(false)
  const [draggingVideoClipIds, setDraggingVideoClipIds] = React.useState<
    string[]
  >([])

  const applyVideoTrim = React.useCallback(
    (clientX: number) => {
      const drag = videoDragRef.current
      if (!drag || !mainFilmstrip) return
      const pointerMs = clipMsFromClientX(clientX)
      if (drag.mode === "move") {
        const nextStart = Math.max(0, pointerMs - drag.grabOffsetMs)
        const delta = nextStart - drag.timelineStartMs
        for (const clip of drag.movingClips) {
          updateVideoClip(clip.id, {
            timelineStartMs: Math.max(0, clip.timelineStartMs + delta),
          })
        }
      } else if (drag.mode === "trim-start") {
        const startMs = Math.max(
          0,
          Math.min(
            drag.endMs - MIN_CLIP_MS,
            drag.startMs + (pointerMs - drag.timelineStartMs)
          )
        )
        updateVideoClip(drag.id, {
          startMs,
          timelineStartMs: drag.timelineStartMs + (startMs - drag.startMs),
        })
      } else {
        const endMs = Math.max(
          drag.startMs + MIN_CLIP_MS,
          Math.min(
            mainFilmstrip.durationMs,
            drag.startMs + (pointerMs - drag.timelineStartMs)
          )
        )
        updateVideoClip(drag.id, { endMs })
      }
    },
    [clipMsFromClientX, mainFilmstrip, updateVideoClip]
  )

  const onVideoPointerDown = React.useCallback(
    (event: React.PointerEvent, id: string, mode?: VideoTrimDragMode) => {
      if (!mainIsVideo) return
      // Match animation clips: block every mouse button from reaching the
      // timeline scrubber. A right-click must remain owned by ContextMenuTrigger.
      event.stopPropagation()
      if (event.button !== 0 || event.ctrlKey) {
        setSelectedVideoClipIds((ids) => (ids.includes(id) ? ids : [id]))
        selectAnimationClip(null)
        return
      }
      const movingIds = selectedVideoClipIds.includes(id)
        ? selectedVideoClipIds
        : [id]
      setSelectedVideoClipIds(movingIds)
      selectAnimationClip(null)
      const clip = resolvedVideoClips.find((item) => item.id === id)
      if (razorModeRef.current && clip) {
        const atMs =
          clip.startMs +
          (clipMsFromClientX(event.clientX) - clip.timelineStartMs)
        if (
          atMs <= clip.startMs + MIN_CLIP_MS ||
          atMs >= clip.endMs - MIN_CLIP_MS
        ) {
          toast.error("Clip is too short to cut")
          return
        }
        const newId = splitVideoClip(id, atMs)
        if (newId) setSelectedVideoClipIds([newId])
        return
      }
      if (!mode || !mainFilmstrip) return
      event.currentTarget.setPointerCapture(event.pointerId)
      videoDragRef.current = {
        id,
        mode,
        timelineStartMs: clip?.timelineStartMs ?? 0,
        startMs: clip?.startMs ?? 0,
        endMs: clip?.endMs ?? mainFilmstrip.durationMs,
        grabOffsetMs:
          clipMsFromClientX(event.clientX) - (clip?.timelineStartMs ?? 0),
        movingClips: resolvedVideoClips
          .filter((item) => movingIds.includes(item.id))
          .map((item) => ({
            id: item.id,
            timelineStartMs: item.timelineStartMs,
          })),
        captureTarget: event.currentTarget,
        pointerId: event.pointerId,
        wasSelected: selectedVideoClipIds.includes(id),
        downX: event.clientX,
        moved: false,
      }
      setTrimmingVideo(true)
      pointerXRef.current = event.clientX
      startAutoScroll(applyVideoTrim)
    },
    [
      applyVideoTrim,
      clipMsFromClientX,
      mainFilmstrip,
      mainIsVideo,
      resolvedVideoClips,
      selectAnimationClip,
      selectedVideoClipIds,
      setSelectedVideoClipIds,
      splitVideoClip,
      startAutoScroll,
    ]
  )

  const onVideoPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const drag = videoDragRef.current
      if (!drag) return
      if (!drag.moved && Math.abs(event.clientX - drag.downX) > 4) {
        drag.moved = true
        if (drag.mode === "move") {
          setDraggingVideoClipIds(drag.movingClips.map((clip) => clip.id))
        }
      }
      pointerXRef.current = event.clientX
      applyVideoTrim(event.clientX)
    },
    [applyVideoTrim]
  )

  const onVideoPointerUp = React.useCallback(
    (event: React.PointerEvent) => {
      const drag = videoDragRef.current
      if (!drag) return
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      if (drag.mode === "move") {
        const dropped = Math.max(
          0,
          clipMsFromClientX(event.clientX) - drag.grabOffsetMs
        )
        const groupStart = Math.min(
          ...drag.movingClips.map((clip) => clip.timelineStartMs)
        )
        const groupEnd = Math.max(
          ...drag.movingClips.map((clip) => {
            const source = resolvedVideoClips.find(
              (item) => item.id === clip.id
            )
            return (
              clip.timelineStartMs +
              (source ? source.endMs - source.startMs : 0)
            )
          })
        )
        const draggedOffset = drag.timelineStartMs - groupStart
        const others = resolvedVideoClips
          .filter(
            (clip) => !drag.movingClips.some((item) => item.id === clip.id)
          )
          .map((clip) => ({
            startMs: clip.timelineStartMs,
            durationMs: clip.endMs - clip.startMs,
          }))
        const {
          startMs: insertedStart,
          shiftAfterMs,
          shiftMs,
        } = resolveRippleDrop(
          dropped - draggedOffset,
          groupEnd - groupStart,
          others,
          MAX_DURATION_MS
        )
        for (const clip of drag.movingClips) {
          updateVideoClip(clip.id, {
            timelineStartMs:
              insertedStart + (clip.timelineStartMs - groupStart),
          })
        }
        for (const clip of resolvedVideoClips) {
          if (
            drag.movingClips.some((item) => item.id === clip.id) ||
            clip.timelineStartMs < shiftAfterMs
          ) {
            continue
          }
          updateVideoClip(clip.id, {
            timelineStartMs: Math.min(
              clip.timelineStartMs + shiftMs,
              Math.max(0, MAX_DURATION_MS - (clip.endMs - clip.startMs))
            ),
          })
        }
      }
      if (!drag.moved && drag.wasSelected) setSelectedVideoClipIds([])
      videoDragRef.current = null
      setTrimmingVideo(false)
      setDraggingVideoClipIds([])
      stopAutoScroll()
    },
    [
      clipMsFromClientX,
      resolvedVideoClips,
      setSelectedVideoClipIds,
      stopAutoScroll,
      updateVideoClip,
    ]
  )

  const videoRowRef = React.useRef<HTMLDivElement | null>(null)
  const videoMarqueeRef = React.useRef<{
    startX: number
    active: boolean
  } | null>(null)
  const [videoMarqueeRect, setVideoMarqueeRect] = React.useState<{
    left: number
    width: number
  } | null>(null)

  const onVideoRowPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      // The animation row stops propagation before its button guard. Keep the
      // video row identical so right-click cannot start the parent scrubber.
      event.stopPropagation()
      // Context-menu item presses bubble here through the portal (React
      // portals bubble through the React tree, not the DOM). Capturing the
      // pointer then would retarget pointerup away from the menu item and
      // swallow its click — same menu-open guard as the animation clips row.
      if (event.button !== 0 || razorModeRef.current || menuOpenRef.current)
        return
      const row = videoRowRef.current
      if (!row) return
      const rect = row.getBoundingClientRect()
      videoMarqueeRef.current = {
        startX: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
        active: false,
      }
      row.setPointerCapture(event.pointerId)
    },
    []
  )

  const onVideoRowPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      const marquee = videoMarqueeRef.current
      const row = videoRowRef.current
      if (!marquee || !row) return
      const rect = row.getBoundingClientRect()
      const currentX = Math.max(
        0,
        Math.min(rect.width, event.clientX - rect.left)
      )
      if (!marquee.active && Math.abs(currentX - marquee.startX) <= 4) return
      marquee.active = true
      const left = Math.min(marquee.startX, currentX)
      const right = Math.max(marquee.startX, currentX)
      const minMs = (left / pxPerSecondRef.current) * 1000
      const maxMs = (right / pxPerSecondRef.current) * 1000
      setVideoMarqueeRect({ left, width: right - left })
      setSelectedVideoClipIds(
        resolvedVideoClips
          .filter(
            (clip) =>
              clip.timelineStartMs <= maxMs &&
              clip.timelineStartMs + clip.endMs - clip.startMs >= minMs
          )
          .map((clip) => clip.id)
      )
    },
    [resolvedVideoClips, setSelectedVideoClipIds]
  )

  const onVideoRowPointerUp = React.useCallback((event: React.PointerEvent) => {
    if (!videoMarqueeRef.current) return
    videoMarqueeRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setVideoMarqueeRect(null)
  }, [])

  const deleteVideo = React.useCallback(
    (id?: string) => {
      const targetIds =
        id && selectedVideoClipIds.includes(id)
          ? selectedVideoClipIds
          : id
            ? [id]
            : selectedVideoClipIds
      if (targetIds.length) removeVideoClips(targetIds)
      else setScreenshot(null)
      setSelectedVideoClipIds([])
    },
    [
      removeVideoClips,
      selectedVideoClipIds,
      setScreenshot,
      setSelectedVideoClipIds,
    ]
  )

  const duplicateVideo = React.useCallback(
    (id: string) => {
      const clip = resolvedVideoClips.find((item) => item.id === id)
      if (!clip) return
      const newId = duplicateVideoClip(id, clip.endMs - clip.startMs)
      if (newId) setSelectedVideoClipIds([newId])
    },
    [duplicateVideoClip, resolvedVideoClips, setSelectedVideoClipIds]
  )

  const copyVideoClip = React.useCallback(
    (id: string) => {
      const clip = resolvedVideoClips.find((item) => item.id === id)
      if (!clip || !navigator.clipboard) {
        toast.error("Clipboard is not available")
        return
      }
      void navigator.clipboard
        .writeText(
          JSON.stringify({
            type: "tokokino-video-clip",
            startMs: clip.startMs,
            endMs: clip.endMs,
            muted: clip.muted,
          })
        )
        .then(() => toast.success("Video clip copied"))
        .catch(() => toast.error("Could not copy video clip"))
    },
    [resolvedVideoClips]
  )

  const scrubbingRef = React.useRef(false)

  const applyScrub = React.useCallback(
    (clientX: number) => seek(msFromClientX(clientX)),
    [seek, msFromClientX]
  )

  const onScrubDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) return
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
      const target = pickTargetRef.current
      if (isVideoFile(file)) {
        if (target !== "main" || screenshotSlots.length > 0) {
          toast.error("Videos can only be used as a single screenshot")
          return
        }
        if (file.size > VIDEO_SIZE_LIMIT) {
          toast.error("Video is too large (max 1 GB)")
          return
        }
        setScreenshot(createVideoObjectUrl(file))
        return
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image or video file")
        return
      }
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
    [setScreenshot, setScreenshotSlotImage, screenshotSlots.length]
  )

  const videoEl = useVideoRegistry((s) =>
    activeCanvasId ? (s.videos[activeCanvasId] ?? null) : null
  )
  const [videoElementMuted, setVideoElementMuted] = React.useState(() =>
    getVideoMutedPreferenceSync()
  )
  const [videoHasAudio, setVideoHasAudio] = React.useState(false)

  React.useEffect(() => {
    const el = videoEl
    if (!el) return
    const sync = () => {
      setVideoElementMuted(el.muted)
      setVideoHasAudio(videoElementHasAudio(el))
    }
    const boot = requestAnimationFrame(sync)
    el.addEventListener("volumechange", sync)
    el.addEventListener("loadedmetadata", sync)
    el.addEventListener("loadeddata", sync)
    el.addEventListener("play", sync)
    el.addEventListener("timeupdate", sync)
    return () => {
      cancelAnimationFrame(boot)
      el.removeEventListener("volumechange", sync)
      el.removeEventListener("loadedmetadata", sync)
      el.removeEventListener("loadeddata", sync)
      el.removeEventListener("play", sync)
      el.removeEventListener("timeupdate", sync)
    }
  }, [videoEl])

  const canMuteVideo = Boolean(videoEl) && videoHasAudio

  const selectedVideoClip = React.useMemo(
    () =>
      selectedVideoClipId
        ? (resolvedVideoClips.find((clip) => clip.id === selectedVideoClipId) ??
          null)
        : null,
    [resolvedVideoClips, selectedVideoClipId]
  )
  const videoMuted = selectedVideoClip?.muted ?? videoElementMuted

  const onToggleVideoMute = React.useCallback(() => {
    const el = videoEl
    if (!el) return
    if (selectedVideoClip) {
      const next = !videoMuted
      updateVideoClip(selectedVideoClip.id, { muted: next })
      // eslint-disable-next-line react-hooks/immutability
      el.muted = next
      setVideoElementMuted(next)
      return
    }
    const next = !el.muted
    applyVideoMutedToAll(useVideoRegistry.getState().videos, next)
    setVideoMutedPreference(next)
  }, [selectedVideoClip, updateVideoClip, videoEl, videoMuted])

  const toggleVideoClipMute = React.useCallback(
    (id: string) => {
      const clip = resolvedVideoClips.find((item) => item.id === id)
      if (!clip) return
      const muted = !(clip.muted ?? getVideoMutedPreferenceSync())
      updateVideoClip(id, { muted })
      if (id === selectedVideoClipId && videoEl) {
        // eslint-disable-next-line react-hooks/immutability
        videoEl.muted = muted
        setVideoElementMuted(muted)
      }
    },
    [resolvedVideoClips, selectedVideoClipId, updateVideoClip, videoEl]
  )

  const clipsRowRef = React.useRef<HTMLDivElement | null>(null)
  const ghostRef = React.useRef<HTMLDivElement | null>(null)
  const ghostStartMsRef = React.useRef(0)
  const [ghostVisible, setGhostVisible] = React.useState(false)
  const ghostWidthPx = pxFor(GHOST_SLOT_MS)

  const ghostRafRef = React.useRef<number | null>(null)
  const ghostClientXRef = React.useRef(0)
  const ghostHoveringRef = React.useRef(false)

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
  const marqueeIdsRef = React.useRef<string[]>([])
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
    const curX = Math.max(0, clientX - rect.left)
    const left = Math.min(drag.startX, curX)
    const right = Math.max(drag.startX, curX)
    setMarqueeRect({ left, width: right - left })
    const minMs = (left / pps) * 1000
    const maxMs = (right / pps) * 1000
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
      marqueeActiveRef.current ||
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

  React.useEffect(() => {
    if (ghostHoveringRef.current) scheduleGhost()
  }, [pxPerSecond, scheduleGhost])

  React.useEffect(
    () => () => {
      if (ghostRafRef.current != null) cancelAnimationFrame(ghostRafRef.current)
    },
    []
  )

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
        if (!drag.active && Math.abs(e.clientX - pointerXRef.current) <= 4) {
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
      if (razorModeRef.current || menuOpenRef.current || dragRef.current) return
      if (suppressRowClickRef.current) {
        suppressRowClickRef.current = false
        return
      }
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
      menuClosedAtRef.current = Date.now()
    }
  }, [])

  const onVideoMenuOpenChange = React.useCallback(
    (open: boolean) => {
      onClipMenuOpenChange(open)
      if (!open) return

      // A context click/long-press can arrive after a pointer-down began a drag.
      // Pointer capture would retarget menu clicks back to the video clip, so
      // cancel the drag and release capture before Radix receives item clicks.
      const drag = videoDragRef.current
      if (!drag) return
      if (drag.captureTarget.hasPointerCapture?.(drag.pointerId)) {
        drag.captureTarget.releasePointerCapture?.(drag.pointerId)
      }
      videoDragRef.current = null
      setTrimmingVideo(false)
      setDraggingVideoClipIds([])
      stopAutoScroll()
    },
    [onClipMenuOpenChange, stopAutoScroll]
  )

  const addClip = React.useCallback(
    () => selectAnimationClip(addAnimationClip()),
    [addAnimationClip, selectAnimationClip]
  )

  const resolveTargetIds = React.useCallback((id: string) => {
    const sel = selectedIdsRef.current
    return sel.includes(id) && sel.length > 0 ? sel : [id]
  }, [])

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

  const [razorMode, setRazorMode] = React.useState(false)
  const razorModeRef = React.useRef(false)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    razorModeRef.current = razorMode
  }, [razorMode])

  const canRazor = clips.length > 0 || resolvedVideoClips.length > 0
  React.useEffect(() => {
    if (clips.length === 0 && resolvedVideoClips.length === 0)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRazorMode(false)
  }, [clips.length, resolvedVideoClips.length])

  const toggleRazor = React.useCallback(() => {
    setRazorMode((m) =>
      clipsRef.current.length > 0 || resolvedVideoClips.length > 0 ? !m : false
    )
  }, [resolvedVideoClips.length])

  const requestExit = React.useCallback(() => {
    setIsAnimateMode(false)
  }, [setIsAnimateMode])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      if (razorModeRef.current) {
        setRazorMode(false)
        return
      }
      requestExit()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [requestExit])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ids = selectedIdsRef.current
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return
      }
      if (videoSelected) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault()
          deleteVideo()
        }
        return
      }
      if (ids.length === 0) return
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey
      ) {
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
    videoSelected,
    deleteVideo,
    duplicateVideo,
    toggleVideoClipMute,
    copyVideoClip,
  ])

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

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "m" && e.key !== "M") return
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
      onToggleVideoMute()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onToggleVideoMute])

  const ticks = computeTicks(timelineEndMs, pxPerSecond)

  const staticMainThumb = React.useMemo<ClipThumb | null>(
    () =>
      !mainIsVideo && screenshot
        ? { src: screenshot, objectPosition: mainObjectPosition }
        : null,
    [mainIsVideo, screenshot, mainObjectPosition]
  )

  // The video frame visible at a given timeline moment: map timeline time →
  // source time through the covering video clip (respecting trim/offset), then
  // pick the filmstrip tile sampling that time. This makes a clip's thumbnail
  // show the frame where the clip starts, not always the video's first frame.
  const videoThumbAt = React.useCallback(
    (timelineMs: number): ClipThumb | null => {
      const strip = mainFilmstrip
      if (!strip || strip.frames.length === 0) return null
      const covering =
        resolvedVideoClips.find(
          (c) =>
            timelineMs >= c.timelineStartMs &&
            timelineMs < c.timelineStartMs + (c.endMs - c.startMs)
        ) ?? resolvedVideoClips[0]
      const sourceMs = covering
        ? covering.startMs + Math.max(0, timelineMs - covering.timelineStartMs)
        : timelineMs
      const frac =
        strip.durationMs > 0
          ? Math.max(0, Math.min(1, sourceMs / strip.durationMs))
          : 0
      const idx = Math.min(
        strip.frames.length - 1,
        Math.max(0, Math.floor(frac * strip.targetFrames))
      )
      return { src: strip.frames[idx] }
    },
    [mainFilmstrip, resolvedVideoClips]
  )

  const resolveClipImages = React.useCallback(
    (clip: (typeof clips)[number]): ClipThumb[] => {
      const mainThumb = mainIsVideo
        ? videoThumbAt(clip.startMs)
        : staticMainThumb
      const target = clip.target ?? { scope: "all" as const }
      if (target.scope === "slot") {
        const slot = screenshotSlots.find((s) => s.id === target.slotId)
        if (slot?.src) {
          return [
            {
              src: slot.src,
              objectPosition: fullPageCaptureMediaStyle(slot.fullPageCapture)
                ?.objectPosition as string | undefined,
            },
          ]
        }
        return mainThumb ? [mainThumb] : []
      }
      if (target.scope === "main") {
        return mainThumb ? [mainThumb] : []
      }
      const thumbs: ClipThumb[] = []
      if (mainThumb) thumbs.push(mainThumb)
      for (const slot of screenshotSlots) {
        if (!slot.src) continue
        thumbs.push({
          src: slot.src,
          objectPosition: fullPageCaptureMediaStyle(slot.fullPageCapture)
            ?.objectPosition as string | undefined,
        })
      }
      return thumbs
    },
    [mainIsVideo, videoThumbAt, staticMainThumb, screenshotSlots]
  )

  const resolveClipIcons = React.useCallback(
    (clip: (typeof clips)[number]): ClipIconKey[] => clip.effects ?? [],
    []
  )

  const selectedClip = React.useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  )

  return {
    playheadMs,
    durationMs,
    isPlaying,
    toggle,
    reset,
    screenshot,
    layers,
    clips,

    pxFor,
    contentWidth,
    ticks,
    lastClipEnd,

    selectedClipId,
    selectedClipIds,
    highlightedClipIds,
    selectedClip,
    selectedVideoClipId,
    selectedVideoClipIds,
    videoSelected,
    trimmingVideo,
    draggingVideoClipIds,
    updateAnimationClip,
    draggingClipId,
    interactingClipId,
    clipsAnimated,
    dupShortcut,
    clearEffectsShortcut,
    deselectShortcut,

    scrollRef,
    trackRef,
    clipsRowRef,
    ghostRef,
    screenshotInputRef,

    resolveClipImages,
    resolveClipIcons,

    ghostVisible,
    ghostWidthPx,

    isDurationDragging,
    onDurationHandleDown,
    onDurationHandleMove,
    onDurationHandleUp,

    onScrubDown,
    onScrubMove,
    onScrubUp,

    onClipsRowMove,
    onClipsRowLeave,
    onClipsRowClick,
    onClipsRowPointerDown,
    onClipsRowPointerUp,
    onClipPointerDown,
    onClipPointerMove,
    onClipPointerUp,
    onClipMenuOpenChange,
    onVideoMenuOpenChange,
    deselectClip,
    duplicateClip,
    clearClipEffects,
    deleteClip,
    deleteVideo,
    duplicateVideo,
    toggleVideoClipMute,
    copyVideoClip,
    onVideoPointerDown,
    onVideoPointerMove,
    onVideoPointerUp,
    videoRowRef,
    videoMarqueeRect,
    onVideoRowPointerDown,
    onVideoRowPointerMove,
    onVideoRowPointerUp,
    deselectVideo: () => setSelectedVideoClipIds([]),

    marqueeRect,

    addClip,
    deleteSelectedClip,
    razorMode,
    canRazor,
    toggleRazor,
    videoMuted,
    canMuteVideo,
    onToggleVideoMute,

    onLayerClick,
    onPickScreenshot,

    requestExit,
  }
}
