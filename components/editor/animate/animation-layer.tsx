"use client"

import * as React from "react"

import { useAnimationPlayer } from "@/hooks/use-animation-player"
import {
  composeTransformAtTime,
  transformToCss,
} from "@/lib/editor/animation-presets"
import { useActiveCanvasField, useActiveCanvasId } from "@/lib/editor/store"

const VARS = ["--anim-transform", "--anim-opacity", "--anim-filter"] as const

/**
 * Renders nothing — it drives the on-canvas animation by writing CSS custom
 * properties to the active canvas node each playhead tick. The main screenshot
 * wrapper reads those vars (see MainScreenshotRender), so the same
 * `composeTransformAtTime` used by the exporter produces the live preview.
 */
export function AnimationLayer() {
  const { playheadMs } = useAnimationPlayer()
  const activeCanvasId = useActiveCanvasId()
  const clips = useActiveCanvasField((c) => c.animation?.clips ?? [])

  React.useLayoutEffect(() => {
    const node = document.querySelector<HTMLElement>(
      `[data-canvas-id="${activeCanvasId}"]`
    )
    if (!node) return
    const t = composeTransformAtTime(clips, playheadMs)
    const css = transformToCss(t)
    node.style.setProperty("--anim-transform", css.transform)
    node.style.setProperty("--anim-opacity", css.opacity)
    node.style.setProperty("--anim-filter", css.filter)
    return () => {
      for (const v of VARS) node.style.removeProperty(v)
    }
  }, [playheadMs, clips, activeCanvasId])

  return null
}
