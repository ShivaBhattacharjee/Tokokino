"use client"

import * as React from "react"

import {
  PositionSwipeField,
  type PositionSwipePoint,
} from "@/components/editor/position-swipe-field"
import {
  afterPositionPreviewCleared,
  clearPositionPreviewVarsAfterPaint,
  setElementPositionPreview,
  setMainScreenshotBarePreviewPx,
  setMainScreenshotPositionPreview,
} from "@/components/editor/position-preview-vars"
import { EffectSlider } from "@/components/editor/inspector/effect-slider"
import {
  allScreenshotGroupCenter,
  screenshotSlotGroupCenter,
} from "@/components/editor/floating-toolbar-parts/geometry"
import { livePreviewRoots } from "@/lib/editor/live-preview-roots"
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
 * that slot's position/scale, a main clip drives the main screenshot, and an
 * "all" clip (or empty selection in a multi layout) moves every screenshot
 * together — the same composition move the floating toolbar uses.
 */
export function PositionSection() {
  const editor = useEditor()
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setScale = useEditorStore((s) => s.setScale)
  const setScreenshotScale = useEditorStore((s) => s.setScreenshotScale)
  const setScreenshotPositionDragging = useEditorStore(
    (s) => s.setScreenshotPositionDragging
  )
  const updateScreenshotSlot = useEditorStore((s) => s.updateScreenshotSlot)
  const setScreenshotSlotGroupPosition = useEditorStore(
    (s) => s.setScreenshotSlotGroupPosition
  )

  const CANVAS_SCALE_VAR = "--canvas-ts-scale"
  const SLOT_SCALE_VAR = "--slot-ts-scale"

  // Which screenshot the pad edits follows the current selection — a screenshot
  // box clicked on the canvas OR the box targeted by the open keyframe (both set
  // `selectedScreenshotSlotId` / `isScreenshotSelected`). A slot wins over main.
  // With nothing selected in a multi layout, the pad drives ALL screenshots
  // (main + every slot), matching clip.target "all" and the floating toolbar.
  const selectedSlot = editor.selectedScreenshotSlotId
    ? (editor.screenshotSlots.find(
        (slot) => slot.id === editor.selectedScreenshotSlotId
      ) ?? null)
    : null
  const mainSelected = editor.isScreenshotSelected
  const hasSlots = editor.screenshotSlots.length > 0
  const isAllTarget = hasSlots && !selectedSlot && !mainSelected

  const hasDeviceFrame = editor.frame.id !== "none"
  const hasTweet = Boolean(editor.tweet)
  const hasMainScreenshot = Boolean(editor.screenshot)
  // The canvas ALWAYS has a positionable main box — a screenshot, tweet, device
  // frame, or (when none exist yet) the empty-state placeholder — so the pad can
  // move it and record a position keyframe even before an image is added.
  // Multi layouts always include the main box as slot 0 of the row layout.
  const hasMainScreenshotBox =
    hasMainScreenshot || hasTweet || hasDeviceFrame || hasSlots
  // "Bare" = a frame-less REAL screenshot (placed by absolute px). The empty box
  // and framed targets use the %/anchor path instead. Only relevant when the pad
  // is editing the main screenshot alone (no slot, not all-group).
  const isBareMainTarget =
    !selectedSlot &&
    !isAllTarget &&
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

  const querySlotElement = React.useCallback(
    (slotId: string) =>
      getActiveCanvasElement()?.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${CSS.escape(slotId)}"]`
      ) ?? null,
    [getActiveCanvasElement]
  )

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

  const collectAllPreviewElements = React.useCallback(() => {
    const canvasElement = getActiveCanvasElement()
    if (!canvasElement) return []
    const elements: Array<HTMLElement | null> = [canvasElement]
    for (const slot of editor.screenshotSlots) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-screenshot-slot-id="${CSS.escape(slot.id)}"]`
        )
      )
    }
    return elements
  }, [editor.screenshotSlots, getActiveCanvasElement])

  const currentPosition = React.useMemo<PositionSwipePoint | null>(() => {
    if (selectedSlot) {
      return {
        xPct: clampPercent(selectedSlot.xPct),
        yPct: clampPercent(selectedSlot.yPct),
      }
    }
    if (isAllTarget) {
      const center = allScreenshotGroupCenter({
        hasMainScreenshot: hasMainScreenshotBox,
        aspect: editor.aspect,
        frame: editor.frame,
        position: editor.screenshotPosition,
        offset: editor.screenshotOffset,
        slots: editor.screenshotSlots,
      })
      if (!center) return { xPct: 50, yPct: 50 }
      return {
        xPct: clampPercent(center.xPct),
        yPct: clampPercent(center.yPct),
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
    const point = mainScreenshotPositionPct({
      aspect: editor.aspect,
      frame: editor.frame,
      position: editor.screenshotPosition,
      offset: editor.screenshotOffset,
      slots: editor.screenshotSlots,
    })
    return { xPct: clampPercent(point.xPct), yPct: clampPercent(point.yPct) }
  }, [
    editor.aspect,
    editor.frame,
    editor.screenshotOffset,
    editor.screenshotPosition,
    editor.screenshotSlots,
    hasMainScreenshotBox,
    isAllTarget,
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
      // Main-screenshot position vars live on the root, so passing every
      // live-preview root drives the preset thumbnails along with the canvas.
      const canvasElement = livePreviewRoots(activeCanvasId)
      if (canvasElement.length === 0) return

      if (selectedSlot) {
        setElementPositionPreview(getSelectedSlotElement(), safePoint)
        return
      }

      if (isAllTarget) {
        const currentGroupCenter = allScreenshotGroupCenter({
          hasMainScreenshot: hasMainScreenshotBox,
          aspect: editor.aspect,
          frame: editor.frame,
          position: editor.screenshotPosition,
          offset: editor.screenshotOffset,
          slots: editor.screenshotSlots,
        })
        if (!currentGroupCenter) return

        const dx = safePoint.xPct - currentGroupCenter.xPct
        const dy = safePoint.yPct - currentGroupCenter.yPct

        if (hasMainScreenshotBox) {
          const mainCenter = mainScreenshotPositionPct({
            aspect: editor.aspect,
            frame: editor.frame,
            position: editor.screenshotPosition,
            offset: editor.screenshotOffset,
            slots: editor.screenshotSlots,
          })
          setMainScreenshotPositionPreview(canvasElement, {
            xPct: clampPercent(mainCenter.xPct + dx),
            yPct: clampPercent(mainCenter.yPct + dy),
          })
        }

        for (const slot of editor.screenshotSlots) {
          setElementPositionPreview(querySlotElement(slot.id), {
            xPct: clampPercent(slot.xPct + dx),
            yPct: clampPercent(slot.yPct + dy),
          })
        }
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
      setMainScreenshotPositionPreview(canvasElement, safePoint)
    },
    [
      editor.aspect,
      editor.frame,
      editor.screenshotOffset,
      editor.screenshotPosition,
      editor.screenshotSlots,
      getActiveCanvasElement,
      getSelectedSlotElement,
      hasMainScreenshotBox,
      isAllTarget,
      isBareMainTarget,
      measureMainStageDims,
      querySlotElement,
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
        if (isAllTarget) {
          const currentGroupCenter = allScreenshotGroupCenter({
            hasMainScreenshot: hasMainScreenshotBox,
            aspect: editor.aspect,
            frame: editor.frame,
            position: editor.screenshotPosition,
            offset: editor.screenshotOffset,
            slots: editor.screenshotSlots,
          })
          if (!currentGroupCenter) return

          const dx = safePoint.xPct - currentGroupCenter.xPct
          const dy = safePoint.yPct - currentGroupCenter.yPct

          if (hasMainScreenshotBox) {
            const mainCenter = mainScreenshotPositionPct({
              aspect: editor.aspect,
              frame: editor.frame,
              position: editor.screenshotPosition,
              offset: editor.screenshotOffset,
              slots: editor.screenshotSlots,
            })
            const nextMain = {
              xPct: mainCenter.xPct + dx,
              yPct: mainCenter.yPct + dy,
            }
            const mainPosId = positionIdFromPercent(
              nextMain.xPct,
              nextMain.yPct
            )
            editor.setScreenshotPlacement(
              mainPosId,
              mainScreenshotOffsetForPoint({
                aspect: editor.aspect,
                frame: editor.frame,
                position: mainPosId,
                slots: editor.screenshotSlots,
                point: nextMain,
              })
            )
          }

          if (editor.screenshotSlots.length > 0) {
            const slotCenter = screenshotSlotGroupCenter(editor.screenshotSlots)
            if (slotCenter) {
              setScreenshotSlotGroupPosition({
                xPct: slotCenter.xPct + dx,
                yPct: slotCenter.yPct + dy,
              })
            }
          }
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
      } finally {
        clearPositionPreviewVarsAfterPaint(
          isAllTarget ? collectAllPreviewElements() : [canvasElement]
        )
      }
    },
    [
      collectAllPreviewElements,
      editor,
      getActiveCanvasElement,
      getSelectedSlotElement,
      hasMainScreenshotBox,
      isAllTarget,
      isBareMainTarget,
      measureMainStageDims,
      scaleFactor,
      selectedSlot,
      setScreenshotSlotGroupPosition,
      updateScreenshotSlot,
    ]
  )

  // Live-preview the zoom by driving the target's `-ts-scale` CSS var (the same
  // override the transform reads for Tilt & Scale) so it updates during the drag
  // without touching the store. State is only committed on release; the var is
  // cleared next frame so the committed `scale` fallback takes over without a
  // transition flash. A selected slot drives its own element; "all" drives main
  // + every slot; otherwise only the main/canvas moves.
  const zoom = selectedSlot ? selectedSlot.scale : editor.scale

  // Preset thumbnails inherit the canvas zoom (`planSinglePreset` takes scale
  // straight off the canvas), so they are driven alongside it — otherwise they
  // sit at the old zoom until the slider is released.
  const getZoomTargets = React.useCallback((): Array<{
    el: HTMLElement
    scaleVar: string
  }> => {
    const roots = livePreviewRoots(activeCanvasId)
    if (roots.length === 0) return []

    const slotIn = (root: HTMLElement, slotId: string) =>
      root.querySelector<HTMLElement>(
        `[data-screenshot-slot-id="${CSS.escape(slotId)}"]`
      )

    if (selectedSlot) {
      return roots.flatMap((root) => {
        const el = slotIn(root, selectedSlot.id)
        return el ? [{ el, scaleVar: SLOT_SCALE_VAR }] : []
      })
    }
    if (!isAllTarget)
      return roots.map((el) => ({ el, scaleVar: CANVAS_SCALE_VAR }))

    return roots.flatMap((root) => {
      const targets: Array<{ el: HTMLElement; scaleVar: string }> = [
        { el: root, scaleVar: CANVAS_SCALE_VAR },
      ]
      for (const slot of editor.screenshotSlots) {
        const el = slotIn(root, slot.id)
        if (el) targets.push({ el, scaleVar: SLOT_SCALE_VAR })
      }
      return targets
    })
  }, [activeCanvasId, editor.screenshotSlots, isAllTarget, selectedSlot])

  const previewScale = React.useCallback(
    (next: number) => {
      for (const { el, scaleVar } of getZoomTargets()) {
        el.style.setProperty(scaleVar, String(next / 100))
      }
    },
    [getZoomTargets]
  )

  const commitScale = React.useCallback(
    (next: number) => {
      const targets = getZoomTargets()

      if (selectedSlot) updateScreenshotSlot(selectedSlot.id, { scale: next })
      else if (isAllTarget) setScreenshotScale(next)
      else setScale(next)

      if (targets.length === 0) return
      const clear = () => {
        for (const { el, scaleVar } of targets) {
          el.style.removeProperty(scaleVar)
        }
      }
      if (typeof requestAnimationFrame === "undefined") {
        clear()
        return
      }
      requestAnimationFrame(clear)
    },
    [
      getZoomTargets,
      isAllTarget,
      selectedSlot,
      setScale,
      setScreenshotScale,
      updateScreenshotSlot,
    ]
  )

  return (
    <div className="space-y-3">
      <PositionSwipeField
        ariaLabel={
          isAllTarget
            ? "Position all screenshots"
            : selectedSlot
              ? "Position screenshot box"
              : "Position screenshot"
        }
        value={currentPosition}
        onPreview={(point) => {
          // Drop the boxes' move easing for the pad drag so they track the pad
          // live instead of easing ~300ms behind it.
          setScreenshotPositionDragging(true)
          previewMoveTo(point)
        }}
        onChange={(point) => {
          moveTo(point)
          // Reset only after the preview-var clear paints, so the main box
          // doesn't ease between its preview and committed representations.
          afterPositionPreviewCleared(() =>
            setScreenshotPositionDragging(false)
          )
        }}
      />
      <EffectSlider
        label="Zoom"
        value={zoom}
        onChange={commitScale}
        onPreview={previewScale}
        min={10}
        max={300}
        suffix="%"
      />
    </div>
  )
}
