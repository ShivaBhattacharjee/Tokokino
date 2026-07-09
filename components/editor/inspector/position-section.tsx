"use client"

import * as React from "react"

import {
  PositionSwipeField,
  type PositionSwipePoint,
} from "@/components/editor/position-swipe-field"
import {
  clearPositionPreviewVarsAfterPaint,
  setElementPositionPreview,
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
 *
 * The pad follows the selected keyframe's target: a slot-targeted clip drives
 * that slot's position/scale (not the main screenshot), a main clip drives the
 * main screenshot, and with no clip open the pad sits centered + disabled since
 * there's no keyframe to record into.
 */
export function PositionSection() {
  const editor = useEditor()
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setScale = useEditorStore((s) => s.setScale)
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)

  const CANVAS_SCALE_VAR = "--canvas-ts-scale"
  const SLOT_SCALE_VAR = "--slot-ts-scale"

  // Which screenshot the pad edits follows the current selection — a screenshot
  // box clicked on the canvas OR the box targeted by the open keyframe (both set
  // `selectedScreenshotSlotId` / `isScreenshotSelected`). A slot wins over main.
  const selectedSlot = editor.selectedScreenshotSlotId
    ? (editor.screenshotSlots.find(
        (slot) => slot.id === editor.selectedScreenshotSlotId
      ) ?? null)
    : null
  const mainSelected = editor.isScreenshotSelected
  const hasSlots = editor.screenshotSlots.length > 0

  // With a single screenshot the pad always drives the main box. Only in a
  // MULTI layout, where "which box?" is ambiguous, does an empty selection
  // disable the pad (centered) until a box is picked.
  const disabled = hasSlots && !selectedSlot && !mainSelected

  const hasDeviceFrame = editor.frame.id !== "none"
  const hasTweet = Boolean(editor.tweet)
  const hasMainScreenshot = Boolean(editor.screenshot)
  // The canvas ALWAYS has a positionable main box — a screenshot, tweet, device
  // frame, or (when none exist yet) the empty-state placeholder — so the pad can
  // move it and record a position keyframe even before an image is added.
  const hasMainTarget = true
  // "Bare" = a frame-less REAL screenshot (placed by absolute px). The empty box
  // and framed targets use the %/anchor path instead. Only relevant when the pad
  // is editing the main screenshot (no slot selected).
  const isBareMainTarget =
    !selectedSlot &&
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

  const getSelectedSlotElement = React.useCallback(() => {
    if (!selectedSlot) return null
    return (
      getActiveCanvasElement()?.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${CSS.escape(selectedSlot.id)}"]`
      ) ?? null
    )
  }, [getActiveCanvasElement, selectedSlot])

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
    // No keyframe open → sit centered so the disabled pad reads as "neutral".
    if (disabled) return { xPct: 50, yPct: 50 }
    if (selectedSlot) {
      return {
        xPct: clampPercent(selectedSlot.xPct),
        yPct: clampPercent(selectedSlot.yPct),
      }
    }
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
    disabled,
    editor.aspect,
    editor.frame,
    editor.screenshotOffset,
    editor.screenshotPosition,
    editor.screenshotSlots,
    hasMainTarget,
    isBareMainTarget,
    mainStageDims,
    scaleFactor,
    selectedSlot,
  ])

  const previewMoveTo = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const canvasElement = getActiveCanvasElement()
      if (!canvasElement) return

      if (selectedSlot) {
        setElementPositionPreview(getSelectedSlotElement(), safePoint)
        return
      }
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
      getSelectedSlotElement,
      hasMainTarget,
      isBareMainTarget,
      measureMainStageDims,
      selectedSlot,
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

      if (selectedSlot) {
        const slotElement = getSelectedSlotElement()
        try {
          updateScreenshotSlot(selectedSlot.id, safePoint)
        } finally {
          clearPositionPreviewVarsAfterPaint([slotElement])
        }
        return
      }

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
      getSelectedSlotElement,
      hasMainTarget,
      isBareMainTarget,
      measureMainStageDims,
      scaleFactor,
      selectedSlot,
      updateScreenshotSlot,
    ]
  )

  // Live-preview the zoom by driving the target's `-ts-scale` CSS var (the same
  // override the transform reads for Tilt & Scale) so it updates during the drag
  // without touching the store. State is only committed on release; the var is
  // cleared next frame so the committed `scale` fallback takes over without a
  // transition flash. A selected slot drives its own element; otherwise the
  // whole canvas moves.
  const zoom = selectedSlot ? selectedSlot.scale : editor.scale

  const previewScale = React.useCallback(
    (next: number) => {
      if (selectedSlot) {
        getSelectedSlotElement()?.style.setProperty(
          SLOT_SCALE_VAR,
          String(next / 100)
        )
        return
      }
      getActiveCanvasElement()?.style.setProperty(
        CANVAS_SCALE_VAR,
        String(next / 100)
      )
    },
    [getActiveCanvasElement, getSelectedSlotElement, selectedSlot]
  )

  const commitScale = React.useCallback(
    (next: number) => {
      const target = selectedSlot ? getSelectedSlotElement() : null
      const scaleVar = selectedSlot ? SLOT_SCALE_VAR : CANVAS_SCALE_VAR
      const element = selectedSlot ? target : getActiveCanvasElement()

      if (selectedSlot) updateScreenshotSlot(selectedSlot.id, { scale: next })
      else setScale(next)

      if (!element) return
      if (typeof requestAnimationFrame === "undefined") {
        element.style.removeProperty(scaleVar)
        return
      }
      requestAnimationFrame(() => {
        element.style.removeProperty(scaleVar)
      })
    },
    [
      getActiveCanvasElement,
      getSelectedSlotElement,
      selectedSlot,
      setScale,
      updateScreenshotSlot,
    ]
  )

  return (
    <div className="space-y-3">
      <PositionSwipeField
        ariaLabel="Position screenshot"
        disabled={disabled}
        value={currentPosition}
        onPreview={previewMoveTo}
        onChange={moveTo}
      />
      <EffectSlider
        label="Zoom"
        value={zoom}
        onChange={commitScale}
        onPreview={previewScale}
        disabled={disabled}
        min={10}
        max={300}
        suffix="%"
      />
    </div>
  )
}
