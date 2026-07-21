"use client"

import * as React from "react"

import {
  EMPTY_BG_STACK,
  EMPTY_FILTER_STACK,
  EMPTY_OVERLAY_STACK,
  EMPTY_PATTERN_STACK,
  EMPTY_PORTRAIT_STACK,
  resolveAnimateBgStack,
  resolveAnimateFilterStack,
  resolveAnimateOverlayStack,
  resolveAnimatePatternStack,
  resolveAnimatePortraitStack,
} from "@/lib/editor/animation-playback"
import type {
  AssetFilter,
  Background,
  BackdropPattern,
  CanvasAnimation,
  Overlay,
  Portrait,
} from "@/lib/editor/state-types"

/**
 * Build the Animate-mode crossfade stacks for every property that layers rather
 * than interpolates — background, backdrop filter, portrait, pattern, overlay.
 * Each gets ONE layer per keyframe so repeated swaps chain (bg1 → bg2 → bg3)
 * instead of every swap cross-fading from the same initial value.
 *
 * Outside animate mode (or with no clips) every stack is empty and the caller
 * renders the committed value as usual.
 */
export function useAnimateStacks({
  isAnimateMode,
  canvasAnimation,
  selectedClipId,
  background,
  filter,
  portrait,
  pattern,
  overlay,
}: {
  isAnimateMode: boolean
  canvasAnimation: CanvasAnimation | undefined
  selectedClipId: string | null
  background: Background
  filter: AssetFilter
  portrait: Portrait
  pattern: BackdropPattern
  overlay: Overlay
}) {
  const clips = isAnimateMode ? (canvasAnimation?.clips ?? null) : null

  const bg = React.useMemo(
    () =>
      clips
        ? resolveAnimateBgStack(clips, background, selectedClipId)
        : EMPTY_BG_STACK,
    [clips, background, selectedClipId]
  )
  const filterStack = React.useMemo(
    () =>
      clips
        ? resolveAnimateFilterStack(clips, filter, selectedClipId)
        : EMPTY_FILTER_STACK,
    [clips, filter, selectedClipId]
  )
  const portraitStack = React.useMemo(
    () =>
      clips
        ? resolveAnimatePortraitStack(clips, portrait, selectedClipId)
        : EMPTY_PORTRAIT_STACK,
    [clips, portrait, selectedClipId]
  )
  const patternStack = React.useMemo(
    () =>
      clips
        ? resolveAnimatePatternStack(clips, pattern, selectedClipId)
        : EMPTY_PATTERN_STACK,
    [clips, pattern, selectedClipId]
  )
  const overlayStack = React.useMemo(
    () =>
      clips
        ? resolveAnimateOverlayStack(clips, overlay, selectedClipId)
        : EMPTY_OVERLAY_STACK,
    [clips, overlay, selectedClipId]
  )

  return { bg, filterStack, portraitStack, patternStack, overlayStack }
}
