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
import { useEditor, useEditorStore } from "@/lib/editor/store"

import {
  bareScreenshotPositionPct,
  bareScreenshotTargetLeftTop,
  clampPercent,
  mainScreenshotOffsetForPoint,
  mainScreenshotPositionPct,
  positionIdFromPercent,
  resolveBareScreenshotPlacement,
  screenshotSlotGroupCenter,
  type StagePlacementDims,
} from "./position-math"

export function MobileMovePanel() {
  const editor = useEditor()
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)

  React.useEffect(() => {
    setActiveTool("position")
    return () => setActiveTool("pointer")
  }, [setActiveTool])

  const selectedText = editor.selectedTextId
    ? editor.texts.find((text) => text.id === editor.selectedTextId)
    : null
  const selectedAsset = editor.selectedAssetId
    ? editor.assets.find((asset) => asset.id === editor.selectedAssetId)
    : null
  const selectedAnnotation = editor.selectedAnnotationShapeId
    ? editor.annotationShapes.find(
        (shape) => shape.id === editor.selectedAnnotationShapeId
      )
    : null
  const selectedSlot = editor.selectedScreenshotSlotId
    ? editor.screenshotSlots.find(
        (slot) => slot.id === editor.selectedScreenshotSlotId
      )
    : null
  const hasDeviceFrame = editor.frame.id !== "none"
  const hasTweet = Boolean(editor.tweet)
  const hasMainTarget = Boolean(editor.screenshot) || hasTweet || hasDeviceFrame
  const hasSlotGroup = editor.screenshotSlots.length > 0
  // The frame-less main screenshot is positioned in real stage pixels (not the
  // base-canvas space), so it needs the DOM-measured placement math below.
  const isBareMainTarget =
    !hasTweet &&
    hasMainTarget &&
    !hasDeviceFrame &&
    editor.screenshotSlots.length === 0
  const targetLabel = selectedText
    ? "text"
    : selectedAsset
      ? "image"
      : selectedAnnotation
        ? "annotation"
        : selectedSlot
          ? "screenshot box"
          : hasTweet
            ? "tweet"
            : hasMainTarget
              ? hasDeviceFrame
                ? "device frame"
                : "screenshot"
              : hasSlotGroup
                ? "screenshot boxes"
                : "nothing"

  const getActiveCanvasElement = React.useCallback(() => {
    if (typeof document === "undefined" || !activeCanvasId) return null
    return document.querySelector<HTMLElement>(
      `[data-canvas-id="${CSS.escape(activeCanvasId)}"]`
    )
  }, [activeCanvasId])

  const queryActiveCanvasElement = React.useCallback(
    (selector: string) =>
      getActiveCanvasElement()?.querySelector<HTMLElement>(selector) ?? null,
    [getActiveCanvasElement]
  )

  // Measure the live stage/image of the frame-less main screenshot in the same
  // CSS-pixel space the canvas renderer uses, so committed placement matches the
  // preview instead of jumping (the stored offset is rendered as raw px).
  const measureMainStageDims =
    React.useCallback((): StagePlacementDims | null => {
      const image = queryActiveCanvasElement("[data-editor-shadow-box-target]")
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
    }, [queryActiveCanvasElement])

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

  const scaleFactor = editor.scale / 100

  const collectPositionPreviewElements = React.useCallback(() => {
    const canvasElement = getActiveCanvasElement()
    if (!canvasElement) return []

    const elements: Array<HTMLElement | null> = [canvasElement]
    if (selectedText) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-editor-text-id="${CSS.escape(selectedText.id)}"]`
        )
      )
    }
    if (selectedAsset) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-editor-asset-id="${CSS.escape(selectedAsset.id)}"]`
        )
      )
    }
    if (selectedAnnotation) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-annotation-shape-id="${CSS.escape(selectedAnnotation.id)}"]`
        )
      )
    }
    for (const slot of editor.screenshotSlots) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-screenshot-slot-id="${CSS.escape(slot.id)}"]`
        )
      )
    }
    return elements
  }, [
    editor.screenshotSlots,
    getActiveCanvasElement,
    selectedAnnotation,
    selectedAsset,
    selectedText,
  ])

  const currentPosition = React.useMemo<PositionSwipePoint | null>(() => {
    if (selectedText)
      return { xPct: selectedText.xPct, yPct: selectedText.yPct }
    if (selectedAsset)
      return { xPct: selectedAsset.xPct, yPct: selectedAsset.yPct }
    if (selectedAnnotation) {
      return {
        xPct: selectedAnnotation.xPct,
        yPct: selectedAnnotation.yPct,
      }
    }
    if (selectedSlot)
      return { xPct: selectedSlot.xPct, yPct: selectedSlot.yPct }
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
    if (hasSlotGroup) return screenshotSlotGroupCenter(editor.screenshotSlots)
    return null
  }, [
    editor.aspect,
    editor.frame,
    editor.screenshotOffset,
    editor.screenshotPosition,
    editor.screenshotSlots,
    hasMainTarget,
    hasSlotGroup,
    isBareMainTarget,
    mainStageDims,
    scaleFactor,
    selectedAnnotation,
    selectedAsset,
    selectedSlot,
    selectedText,
  ])

  const previewMoveTo = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const canvasElement = getActiveCanvasElement()
      if (!canvasElement) return

      if (selectedText) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-editor-text-id="${CSS.escape(selectedText.id)}"]`
          ),
          safePoint
        )
        return
      }
      if (selectedAsset) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-editor-asset-id="${CSS.escape(selectedAsset.id)}"]`
          ),
          safePoint
        )
        return
      }
      if (selectedAnnotation) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-annotation-shape-id="${CSS.escape(selectedAnnotation.id)}"]`
          ),
          safePoint
        )
        return
      }
      if (selectedSlot) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-screenshot-slot-id="${CSS.escape(selectedSlot.id)}"]`
          ),
          safePoint
        )
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
        return
      }
      if (hasSlotGroup) {
        const center = screenshotSlotGroupCenter(editor.screenshotSlots)
        if (!center) return
        const dx = safePoint.xPct - center.xPct
        const dy = safePoint.yPct - center.yPct
        for (const slot of editor.screenshotSlots) {
          setElementPositionPreview(
            queryActiveCanvasElement(
              `[data-screenshot-slot-id="${CSS.escape(slot.id)}"]`
            ),
            {
              xPct: clampPercent(slot.xPct + dx),
              yPct: clampPercent(slot.yPct + dy),
            }
          )
        }
      }
    },
    [
      editor.screenshotSlots,
      getActiveCanvasElement,
      hasMainTarget,
      hasSlotGroup,
      isBareMainTarget,
      measureMainStageDims,
      queryActiveCanvasElement,
      selectedAnnotation,
      selectedAsset,
      selectedSlot,
      selectedText,
    ]
  )

  const moveTo = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const position = positionIdFromPercent(safePoint.xPct, safePoint.yPct)

      try {
        if (selectedText) {
          editor.updateText(selectedText.id, safePoint)
          return
        }
        if (selectedAsset) {
          editor.updateAsset(selectedAsset.id, safePoint)
          return
        }
        if (selectedAnnotation) {
          editor.updateAnnotationShape(selectedAnnotation.id, safePoint)
          return
        }
        if (selectedSlot) {
          editor.updateScreenshotSlot(selectedSlot.id, safePoint)
          return
        }
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
          return
        }
        if (hasSlotGroup) {
          editor.setScreenshotSlotGroupPosition(safePoint)
        }
      } finally {
        clearPositionPreviewVarsAfterPaint(collectPositionPreviewElements())
      }
    },
    [
      collectPositionPreviewElements,
      editor,
      hasMainTarget,
      hasSlotGroup,
      isBareMainTarget,
      measureMainStageDims,
      scaleFactor,
      selectedAnnotation,
      selectedAsset,
      selectedSlot,
      selectedText,
    ]
  )

  return (
    <div className="mx-auto w-full max-w-[360px] px-1">
      <PositionSwipeField
        ariaLabel={`Move ${targetLabel}`}
        disabled={targetLabel === "nothing"}
        value={currentPosition}
        onPreview={previewMoveTo}
        onChange={moveTo}
      />
    </div>
  )
}
