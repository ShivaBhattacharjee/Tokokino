"use client"

/**
 * On-canvas Animate-mode playback.
 *
 * Drives the screenshots' live-preview override vars from the animation timeline
 * via the shared `applyAnimationFrameAtTime` sampler — the SAME function the
 * GIF/WebM exporter uses, so preview always matches export.
 *
 * Motion is applied while playing or parked mid-timeline; at rest (playhead at
 * 0, not playing) every override is cleared so the static committed pose shows.
 */

import * as React from "react"

import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import {
  applyAnimationFrameAtTime,
  clearAnimationFrameVars,
  measureBareStageDims,
} from "@/lib/editor/apply-animation-frame"
import type { StagePlacementDims } from "@/components/editor/mobile-controls/position-math"
import { useEditorStore } from "@/lib/editor/store"

export function AnimationLayer() {
  const player = useAnimationPlayerOptional()
  const playheadMs = player?.playheadMs ?? 0
  const isPlaying = player?.isPlaying ?? false

  const canvas = useEditorStore((s) =>
    s.present.canvases.find((c) => c.id === s.present.activeCanvasId)
  )
  const globalAspect = useEditorStore((s) => s.present.aspect)
  const canvasId = canvas?.id ?? null
  const clips = canvas?.animation?.clips
  const scale = canvas?.scale ?? 100
  const slotsLen = canvas?.screenshotSlots?.length ?? 0
  const selectedClipId = useEditorStore((s) => s.selectedAnimationClipId)
  const screenshotPositionDragging = useEditorStore(
    (s) => s.screenshotPositionDragging
  )

  const frame = canvas?.frame
  const hasTweet = Boolean(canvas?.tweet)
  const hasDeviceFrame = (frame?.id ?? "none") !== "none"
  const hasMainScreenshot = Boolean(canvas?.screenshot)
  const isBareMainTarget =
    !hasTweet && hasMainScreenshot && !hasDeviceFrame && slotsLen === 0

  const dimsRef = React.useRef<StagePlacementDims | null>(null)
  React.useLayoutEffect(() => {
    dimsRef.current = null
  }, [canvasId, scale, canvas?.screenshot, globalAspect, canvas?.aspect])

  // Suppress transform/placement transitions for the whole animate session so
  // per-frame playback isn't smeared ~300ms behind the playhead.
  React.useLayoutEffect(() => {
    if (typeof document === "undefined" || !canvasId) return
    const canvasEl = document.querySelector<HTMLElement>(
      `[data-canvas-id="${canvasId}"]`
    )
    if (!canvasEl) return
    const targets = Array.from(
      canvasEl.querySelectorAll<HTMLElement>(
        "[data-editor-shadow-filter-target], [data-editor-shadow-box-target], [data-screenshot-slot-id]"
      )
    )
    for (const el of targets) el.style.transition = "none"
    return () => {
      for (const el of targets) el.style.removeProperty("transition")
    }
  }, [canvasId, isPlaying, hasMainScreenshot, slotsLen])

  React.useLayoutEffect(() => {
    if (typeof document === "undefined" || !canvasId || !canvas) return
    const canvasEl = document.querySelector<HTMLElement>(
      `[data-canvas-id="${canvasId}"]`
    )
    if (!canvasEl) return
    const frameClips = clips ?? []

    // When a keyframe is open for editing, the store has already loaded that
    // keyframe's resolved pose onto the committed canvas. If playback vars stay
    // active while paused/scrubbed, the screenshot renders at the sampled
    // timeline position while selection chrome and inspector controls still read
    // the committed keyframe pose. Clear overrides so edit handles stay attached
    // to the same visual pose the user is editing.
    if (!isPlaying && selectedClipId) {
      clearAnimationFrameVars(canvasEl, frameClips)
      return
    }

    // Only at rest (stopped at the very start) clear overrides so the committed
    // inspector pose shows. While playing or parked mid-timeline with no open
    // keyframe, hold the sampled frame.
    if (!isPlaying && playheadMs <= 0) {
      clearAnimationFrameVars(canvasEl, frameClips)
      return
    }

    let bareDims: StagePlacementDims | null = null
    if (isBareMainTarget) {
      bareDims = dimsRef.current ?? measureBareStageDims(canvasEl)
      if (bareDims) dimsRef.current = bareDims
    }

    applyAnimationFrameAtTime({
      canvasEl,
      canvas,
      globalAspect,
      clips: frameClips,
      timeMs: playheadMs,
      selectedClipId,
      screenshotPositionDragging,
      bareDims,
    })

    return () => {
      clearAnimationFrameVars(canvasEl, frameClips)
    }
  }, [
    canvas,
    canvasId,
    isPlaying,
    playheadMs,
    clips,
    selectedClipId,
    screenshotPositionDragging,
    isBareMainTarget,
    globalAspect,
  ])

  return null
}
