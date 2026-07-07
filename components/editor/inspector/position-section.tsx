"use client"

import * as React from "react"

import {
  PositionSwipeField,
  type PositionSwipePoint,
} from "@/components/editor/position-swipe-field"
import {
  clearPositionPreviewVarsAfterPaint,
  setMainScreenshotBarePreviewPx,
  setMainScreenshotPositionPreview,
} from "@/components/editor/position-preview-vars"
import { EffectSlider } from "@/components/editor/inspector/effect-slider"
import { useEditor, useEditorStore } from "@/lib/editor/store"

import {
  bareScreenshotPositionPct,
  bareScreenshotTargetLeftTop,
  clampPercent,
  mainScreenshotOffsetForPoint,
  mainScreenshotPositionPct,
  positionIdFromPercent,
  resolveBareScreenshotPlacement,
  type StagePlacementDims,
} from "@/components/editor/mobile-controls/position-math"

/**
 * Placement + zoom shown in the inspector while in Animate mode. Reuses the
 * canvas-wide `PositionSwipeField` (the same drag pad used by the move tool)
 * and the shared main-screenshot placement math, so behaviour matches the rest
 * of the editor instead of introducing a bespoke grid.
 */
export function PositionSection() {
  const editor = useEditor()
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setScale = useEditorStore((s) => s.setScale)

  const CANVAS_SCALE_VAR = "--canvas-ts-scale"

  const hasDeviceFrame = editor.frame.id !== "none"
  const hasTweet = Boolean(editor.tweet)
  const hasMainScreenshot = Boolean(editor.screenshot)
  // The canvas ALWAYS has a positionable main box — a screenshot, tweet, device
  // frame, or (when none exist yet) the empty-state placeholder — so the pad can
  // move it and record a position keyframe even before an image is added.
  // Previously this required a real screenshot, so dragging the inspector pad on
  // an empty canvas silently did nothing and no animation was captured.
  const hasMainTarget = true
  // "Bare" = a frame-less REAL screenshot (placed by absolute px). The empty box
  // and framed targets use the %/anchor path instead.
  const isBareMainTarget =
    !hasTweet &&
    hasMainScreenshot &&
    !hasDeviceFrame &&
    editor.screenshotSlots.length === 0
  const scaleFactor = editor.scale / 100

  const getActiveCanvasElement = React.useCallback(() => {
    if (typeof document === "undefined" || !activeCanvasId) return null
    return document.querySelector<HTMLElement>(
      `[data-canvas-id="${CSS.escape(activeCanvasId)}"]`
    )
  }, [activeCanvasId])

  const measureMainStageDims =
    React.useCallback((): StagePlacementDims | null => {
      const image = getActiveCanvasElement()?.querySelector<HTMLElement>(
        "[data-editor-shadow-box-target]"
      )
      const stage = image?.parentElement
      if (!image || !stage) return null
      const computed = getComputedStyle(stage)
      const dims = {
        stageW: parseFloat(computed.width) || stage.clientWidth,
        stageH: parseFloat(computed.height) || stage.clientHeight,
        imgW: image.offsetWidth,
        imgH: image.offsetHeight,
      }
      if (!dims.stageW || !dims.stageH || !dims.imgW || !dims.imgH) return null
      return dims
    }, [getActiveCanvasElement])

  const [mainStageDims, setMainStageDims] =
    React.useState<StagePlacementDims | null>(null)

  React.useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMainStageDims(isBareMainTarget ? measureMainStageDims() : null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [
    isBareMainTarget,
    measureMainStageDims,
    editor.scale,
    editor.aspect,
    editor.screenshot,
  ])

  const currentPosition = React.useMemo<PositionSwipePoint | null>(() => {
    if (isBareMainTarget && mainStageDims) {
      return bareScreenshotPositionPct({
        dims: mainStageDims,
        scaleFactor,
        position: editor.screenshotPosition,
        offset: editor.screenshotOffset,
      })
    }
    if (hasMainTarget) {
      const point = mainScreenshotPositionPct({
        aspect: editor.aspect,
        frame: editor.frame,
        position: editor.screenshotPosition,
        offset: editor.screenshotOffset,
        slots: editor.screenshotSlots,
      })
      return { xPct: clampPercent(point.xPct), yPct: clampPercent(point.yPct) }
    }
    return null
  }, [
    editor.aspect,
    editor.frame,
    editor.screenshotOffset,
    editor.screenshotPosition,
    editor.screenshotSlots,
    hasMainTarget,
    isBareMainTarget,
    mainStageDims,
    scaleFactor,
  ])

  const previewMoveTo = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const canvasElement = getActiveCanvasElement()
      if (!canvasElement) return

      if (isBareMainTarget) {
        const dims = measureMainStageDims()
        if (dims) {
          const target = bareScreenshotTargetLeftTop(dims, safePoint)
          setMainScreenshotBarePreviewPx(canvasElement, target.left, target.top)
          return
        }
      }
      if (hasMainTarget) {
        setMainScreenshotPositionPreview(canvasElement, safePoint)
      }
    },
    [
      getActiveCanvasElement,
      hasMainTarget,
      isBareMainTarget,
      measureMainStageDims,
    ]
  )

  const moveTo = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const position = positionIdFromPercent(safePoint.xPct, safePoint.yPct)
      const canvasElement = getActiveCanvasElement()

      try {
        if (isBareMainTarget) {
          const dims = measureMainStageDims()
          if (dims) {
            const placement = resolveBareScreenshotPlacement({
              dims,
              scaleFactor,
              point: safePoint,
            })
            editor.setScreenshotPlacement(placement.position, placement.offset)
            return
          }
        }
        if (hasMainTarget) {
          editor.setScreenshotPlacement(
            position,
            mainScreenshotOffsetForPoint({
              aspect: editor.aspect,
              frame: editor.frame,
              position,
              slots: editor.screenshotSlots,
              point: safePoint,
            })
          )
        }
      } finally {
        clearPositionPreviewVarsAfterPaint([canvasElement])
      }
    },
    [
      editor,
      getActiveCanvasElement,
      hasMainTarget,
      isBareMainTarget,
      measureMainStageDims,
      scaleFactor,
    ]
  )

  // Live-preview the zoom by driving the canvas' `--canvas-ts-scale` CSS var
  // (the same override the canvas transform reads for Tilt & Scale) so the
  // canvas updates during the drag without touching the store. State is only
  // committed on release; the var is cleared next frame so the committed
  // `scale` fallback takes over without a transition flash.
  const previewScale = React.useCallback(
    (next: number) => {
      getActiveCanvasElement()?.style.setProperty(
        CANVAS_SCALE_VAR,
        String(next / 100)
      )
    },
    [getActiveCanvasElement]
  )

  const commitScale = React.useCallback(
    (next: number) => {
      setScale(next)
      const canvasElement = getActiveCanvasElement()
      if (!canvasElement) return
      if (typeof requestAnimationFrame === "undefined") {
        canvasElement.style.removeProperty(CANVAS_SCALE_VAR)
        return
      }
      requestAnimationFrame(() => {
        canvasElement.style.removeProperty(CANVAS_SCALE_VAR)
      })
    },
    [getActiveCanvasElement, setScale]
  )

  return (
    <div className="space-y-3">
      <PositionSwipeField
        ariaLabel="Position screenshot"
        value={currentPosition}
        onPreview={previewMoveTo}
        onChange={moveTo}
      />
      <EffectSlider
        label="Zoom"
        value={editor.scale}
        onChange={commitScale}
        onPreview={previewScale}
        min={10}
        max={300}
        suffix="%"
      />
    </div>
  )
}
