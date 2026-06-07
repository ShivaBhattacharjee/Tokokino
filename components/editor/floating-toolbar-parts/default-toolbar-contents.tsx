"use client"

import * as React from "react"
import {
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiGroupLine,
  RiImageAddLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"
import { toast } from "sonner"

import { LayersPanelContent } from "@/components/editor/layers-popover"
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
import {
  bareScreenshotPositionPct,
  bareScreenshotTargetLeftTop,
  resolveBareScreenshotPlacement,
  type StagePlacementDims,
} from "@/components/editor/mobile-controls/position-math"
import {
  ToolbarButton,
  ToolbarPopover,
} from "@/components/editor/toolbar/primitives"
import {
  type EditorTool,
  useActiveCanvasField,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { editorValueSchemas } from "@/lib/editor/value-schemas"
import { readImageFileAsDataUrl } from "@/lib/editor/image-resize"
import { cn } from "@/lib/utils"

import {
  allScreenshotGroupCenter,
  clampPercent,
  mainScreenshotOffsetForPoint,
  mainScreenshotPositionPct,
  positionIdFromPercent,
  screenshotSlotGroupCenter,
} from "./geometry"
import { ENHANCE_PRESETS } from "./options"

export function DefaultToolbarContents() {
  const {
    activeTool,
    setActiveTool,
    aspect,
    screenshotPosition,
    screenshotOffset,
    setScreenshotPlacement,
    addText,
    setSelectedTextId,
    addAsset,
    setSelectedAssetId,
    setIsScreenshotSelected,
    screenshot,
    tweet,
    frame,
    enhance,
    setEnhance,
    scale,
    setScale,
    selectedTextId,
    selectedAssetId,
    selectedAnnotationShapeId,
    texts,
    assets,
    annotationShapes,
    updateText,
    updateAsset,
    updateAnnotationShape,
    screenshotSlots,
    updateScreenshotSlot,
    setSelectedScreenshotSlotId,
    setScreenshotSlotGroupPosition,
  } = useEditor()
  const assetInputRef = React.useRef<HTMLInputElement>(null)

  const selectedText = selectedTextId
    ? texts.find((t) => t.id === selectedTextId)
    : null
  const selectedAsset = selectedAssetId
    ? assets.find((a) => a.id === selectedAssetId)
    : null
  const selectedAnnotation = selectedAnnotationShapeId
    ? annotationShapes.find((s) => s.id === selectedAnnotationShapeId)
    : null
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const selectedSlot = selectedScreenshotSlotId
    ? screenshotSlots.find((slot) => slot.id === selectedScreenshotSlotId)
    : null

  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const activeCanvasPosition = useActiveCanvasField((c) => c.position)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const setCanvasPosition = useEditorStore((s) => s.setCanvasPosition)

  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)

  const [groupAllScreenshots, setGroupAllScreenshots] = React.useState(false)

  type PositionTarget =
    | "text"
    | "asset"
    | "annotation"
    | "slot"
    | "slotGroup"
    | "screenshot"
    | "canvas"
    | "allScreenshots"
    | null

  // Frame and enhance are canvas-shared now; scale is still per-slot.
  const activeFrame = frame
  const activeScale = selectedSlot?.scale ?? scale
  const activeEnhance = enhance
  const hasDeviceFrame = activeFrame.id !== "none"
  const hasMainScreenshotTarget =
    Boolean(screenshot) ||
    Boolean(tweet) ||
    hasDeviceFrame ||
    screenshotSlots.length > 0
  const hasMainScreenshot =
    Boolean(screenshot) || Boolean(tweet) || hasDeviceFrame
  const hasScalableContent = selectedSlot
    ? true
    : hasMainScreenshotTarget || Boolean(tweet)
  const hasAnyScreenshotContent =
    Boolean(screenshot) ||
    Boolean(tweet) ||
    hasDeviceFrame ||
    screenshotSlots.length > 0
  const screenshotBoxCount =
    (hasMainScreenshot ? 1 : 0) + screenshotSlots.length
  const canGroupAllScreenshots = screenshotBoxCount > 1
  const positionTarget: PositionTarget =
    groupAllScreenshots && canGroupAllScreenshots && hasAnyScreenshotContent
      ? "allScreenshots"
      : selectedText
        ? "text"
        : selectedAsset
          ? "asset"
          : selectedAnnotation
            ? "annotation"
            : selectedSlot
              ? "slot"
              : isScreenshotSelected && hasMainScreenshotTarget
                ? "screenshot"
                : screenshotSlots.length > 0
                  ? "slotGroup"
                  : bulkEditMode
                    ? "canvas"
                    : screenshot || tweet || hasDeviceFrame
                      ? "screenshot"
                      : null

  // The frame-less main screenshot is positioned in real stage pixels (mirroring
  // the canvas renderer's placement math), not the base-canvas space the legacy
  // helpers below assume — so it needs DOM-measured dimensions.
  const isBareMainTarget =
    positionTarget === "screenshot" &&
    !hasDeviceFrame &&
    screenshotSlots.length === 0 &&
    Boolean(screenshot)
  const scaleFactor = scale / 100

  // Measure the live stage/image of the frame-less main screenshot in the same
  // CSS-pixel space the canvas renderer uses, so committed placement matches the
  // preview instead of jumping (the stored offset is rendered as raw px).
  const measureMainStageDims =
    React.useCallback((): StagePlacementDims | null => {
      if (typeof document === "undefined" || !activeCanvasId) return null
      const canvasElement = document.querySelector<HTMLElement>(
        `[data-canvas-id="${CSS.escape(activeCanvasId)}"]`
      )
      const image = canvasElement?.querySelector<HTMLElement>(
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
    }, [activeCanvasId])

  const [mainStageDims, setMainStageDims] =
    React.useState<StagePlacementDims | null>(null)

  React.useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMainStageDims(isBareMainTarget ? measureMainStageDims() : null)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [isBareMainTarget, measureMainStageDims, scale, aspect, screenshot])

  const currentPositionPoint = React.useMemo<PositionSwipePoint | null>(() => {
    let xPct: number
    let yPct: number
    if (positionTarget === "text" && selectedText) {
      xPct = selectedText.xPct
      yPct = selectedText.yPct
    } else if (positionTarget === "asset" && selectedAsset) {
      xPct = selectedAsset.xPct
      yPct = selectedAsset.yPct
    } else if (positionTarget === "annotation" && selectedAnnotation) {
      xPct = selectedAnnotation.xPct
      yPct = selectedAnnotation.yPct
    } else if (positionTarget === "slot" && selectedSlot) {
      xPct = selectedSlot.xPct
      yPct = selectedSlot.yPct
    } else if (positionTarget === "slotGroup") {
      if (screenshotSlots.length === 0) return null
      const bounds = screenshotSlots.reduce(
        (acc, slot) => ({
          minX: Math.min(acc.minX, slot.xPct - slot.widthPct / 2),
          maxX: Math.max(acc.maxX, slot.xPct + slot.widthPct / 2),
          minY: Math.min(acc.minY, slot.yPct - slot.heightPct / 2),
          maxY: Math.max(acc.maxY, slot.yPct + slot.heightPct / 2),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      )
      xPct = (bounds.minX + bounds.maxX) / 2
      yPct = (bounds.minY + bounds.maxY) / 2
    } else if (positionTarget === "canvas") {
      const CANVAS_POS_SPREAD = 600
      return {
        xPct: clampPercent(
          (activeCanvasPosition.x / CANVAS_POS_SPREAD) * 50 + 50
        ),
        yPct: clampPercent(
          (activeCanvasPosition.y / CANVAS_POS_SPREAD) * 50 + 50
        ),
      }
    } else if (positionTarget === "allScreenshots") {
      const center = allScreenshotGroupCenter({
        hasMainScreenshot,
        aspect,
        frame,
        position: screenshotPosition,
        offset: screenshotOffset,
        slots: screenshotSlots,
      })
      if (!center) return null
      return {
        xPct: clampPercent(center.xPct),
        yPct: clampPercent(center.yPct),
      }
    } else if (positionTarget === "screenshot") {
      if (isBareMainTarget && mainStageDims) {
        return bareScreenshotPositionPct({
          dims: mainStageDims,
          scaleFactor,
          position: screenshotPosition,
          offset: screenshotOffset,
        })
      }
      const point = mainScreenshotPositionPct({
        aspect,
        frame,
        position: screenshotPosition,
        offset: screenshotOffset,
        slots: screenshotSlots,
      })
      return { xPct: clampPercent(point.xPct), yPct: clampPercent(point.yPct) }
    } else {
      return null
    }
    return { xPct: clampPercent(xPct), yPct: clampPercent(yPct) }
  }, [
    positionTarget,
    selectedText,
    selectedAsset,
    selectedAnnotation,
    selectedSlot,
    screenshotSlots,
    aspect,
    frame,
    screenshotPosition,
    screenshotOffset,
    activeCanvasPosition,
    hasMainScreenshot,
    isBareMainTarget,
    mainStageDims,
    scaleFactor,
  ])

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

  const collectPositionPreviewElements = React.useCallback(() => {
    const canvasElement = getActiveCanvasElement()
    if (!canvasElement) return []

    const elements: Array<HTMLElement | null> = [canvasElement]
    if (selectedTextId) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-editor-text-id="${CSS.escape(selectedTextId)}"]`
        )
      )
    }
    if (selectedAssetId) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-editor-asset-id="${CSS.escape(selectedAssetId)}"]`
        )
      )
    }
    if (selectedAnnotationShapeId) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-annotation-shape-id="${CSS.escape(selectedAnnotationShapeId)}"]`
        )
      )
    }
    for (const slot of screenshotSlots) {
      elements.push(
        canvasElement.querySelector<HTMLElement>(
          `[data-screenshot-slot-id="${CSS.escape(slot.id)}"]`
        )
      )
    }
    return elements
  }, [
    getActiveCanvasElement,
    screenshotSlots,
    selectedAnnotationShapeId,
    selectedAssetId,
    selectedTextId,
  ])

  const applyPositionPoint = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const posId = positionIdFromPercent(safePoint.xPct, safePoint.yPct)

      const emitHideFloatingToolbar = (
        kind: "text" | "asset" | "annotation" | "slot" | "screenshot",
        id: string
      ) => {
        window.dispatchEvent(
          new CustomEvent("tokokino:hide-floating-toolbar", {
            detail: { kind, id, durationMs: 320 },
          })
        )
      }
      const latest = useEditorStore.getState()
      const latestSlotId = latest.selectedScreenshotSlotId
      const latestCanvas = latest.present.canvases.find(
        (c) => c.id === latest.present.activeCanvasId
      )
      const latestSelectedSlot = latestSlotId
        ? (latestCanvas?.screenshotSlots.find((s) => s.id === latestSlotId) ??
          null)
        : null
      if (positionTarget === "text" && selectedTextId) {
        emitHideFloatingToolbar("text", selectedTextId)
        updateText(selectedTextId, safePoint)
      } else if (positionTarget === "asset" && selectedAssetId) {
        emitHideFloatingToolbar("asset", selectedAssetId)
        updateAsset(selectedAssetId, safePoint)
      } else if (positionTarget === "annotation" && selectedAnnotationShapeId) {
        emitHideFloatingToolbar("annotation", selectedAnnotationShapeId)
        updateAnnotationShape(selectedAnnotationShapeId, safePoint)
      } else if (positionTarget === "slot" && latestSelectedSlot) {
        emitHideFloatingToolbar("slot", latestSelectedSlot.id)
        updateScreenshotSlot(latestSelectedSlot.id, safePoint)
      } else if (positionTarget === "slotGroup" && !latestSelectedSlot) {
        setScreenshotSlotGroupPosition(safePoint)
      } else if (positionTarget === "canvas" && activeCanvasId) {
        const CANVAS_POS_SPREAD = 600
        const x = ((safePoint.xPct - 50) / 50) * CANVAS_POS_SPREAD
        const y = ((safePoint.yPct - 50) / 50) * CANVAS_POS_SPREAD
        setCanvasPosition(activeCanvasId, { x, y })
      } else if (positionTarget === "screenshot") {
        emitHideFloatingToolbar("screenshot", "")
        const dims = isBareMainTarget ? measureMainStageDims() : null
        if (dims) {
          const placement = resolveBareScreenshotPlacement({
            dims,
            scaleFactor,
            point: safePoint,
          })
          setScreenshotPlacement(placement.position, placement.offset)
        } else {
          setScreenshotPlacement(
            posId,
            mainScreenshotOffsetForPoint({
              aspect,
              frame,
              position: posId,
              slots: screenshotSlots,
              point: safePoint,
            })
          )
        }
      } else if (positionTarget === "allScreenshots") {
        const currentGroupCenter = allScreenshotGroupCenter({
          hasMainScreenshot,
          aspect,
          frame,
          position: screenshotPosition,
          offset: screenshotOffset,
          slots: screenshotSlots,
        })
        if (!currentGroupCenter) return

        const dx = safePoint.xPct - currentGroupCenter.xPct
        const dy = safePoint.yPct - currentGroupCenter.yPct

        if (hasMainScreenshot) {
          const mainCenter = mainScreenshotPositionPct({
            aspect,
            frame,
            position: screenshotPosition,
            offset: screenshotOffset,
            slots: screenshotSlots,
          })
          setScreenshotPlacement(
            posId,
            mainScreenshotOffsetForPoint({
              aspect,
              frame,
              position: posId,
              slots: screenshotSlots,
              point: {
                xPct: mainCenter.xPct + dx,
                yPct: mainCenter.yPct + dy,
              },
            })
          )
        }

        if (screenshotSlots.length > 0) {
          const slotCenter = screenshotSlotGroupCenter(screenshotSlots)
          if (slotCenter) {
            setScreenshotSlotGroupPosition({
              xPct: slotCenter.xPct + dx,
              yPct: slotCenter.yPct + dy,
            })
          }
        }
      }
      clearPositionPreviewVarsAfterPaint(collectPositionPreviewElements())
    },
    [
      activeCanvasId,
      aspect,
      collectPositionPreviewElements,
      frame,
      hasMainScreenshot,
      isBareMainTarget,
      measureMainStageDims,
      positionTarget,
      scaleFactor,
      screenshotOffset,
      screenshotPosition,
      screenshotSlots,
      selectedAnnotationShapeId,
      selectedAssetId,
      selectedTextId,
      setCanvasPosition,
      setScreenshotPlacement,
      setScreenshotSlotGroupPosition,
      updateAnnotationShape,
      updateAsset,
      updateScreenshotSlot,
      updateText,
    ]
  )

  const previewPositionPoint = React.useCallback(
    (point: PositionSwipePoint) => {
      const safePoint = {
        xPct: clampPercent(point.xPct),
        yPct: clampPercent(point.yPct),
      }
      const canvasElement = getActiveCanvasElement()
      if (!canvasElement) return

      if (positionTarget === "text" && selectedTextId) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-editor-text-id="${CSS.escape(selectedTextId)}"]`
          ),
          safePoint
        )
        return
      }
      if (positionTarget === "asset" && selectedAssetId) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-editor-asset-id="${CSS.escape(selectedAssetId)}"]`
          ),
          safePoint
        )
        return
      }
      if (positionTarget === "annotation" && selectedAnnotationShapeId) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-annotation-shape-id="${CSS.escape(selectedAnnotationShapeId)}"]`
          ),
          safePoint
        )
        return
      }
      if (positionTarget === "slot" && selectedSlot) {
        setElementPositionPreview(
          queryActiveCanvasElement(
            `[data-screenshot-slot-id="${CSS.escape(selectedSlot.id)}"]`
          ),
          safePoint
        )
        return
      }
      if (positionTarget === "slotGroup") {
        const center = screenshotSlotGroupCenter(screenshotSlots)
        if (!center) return
        const dx = safePoint.xPct - center.xPct
        const dy = safePoint.yPct - center.yPct
        for (const slot of screenshotSlots) {
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
        return
      }
      if (positionTarget === "screenshot") {
        if (isBareMainTarget) {
          const dims = measureMainStageDims()
          if (dims) {
            const target = bareScreenshotTargetLeftTop(dims, safePoint)
            setMainScreenshotBarePreviewPx(
              canvasElement,
              target.left,
              target.top
            )
            return
          }
        }
        setMainScreenshotPositionPreview(canvasElement, safePoint)
        return
      }
      if (positionTarget === "allScreenshots") {
        const currentGroupCenter = allScreenshotGroupCenter({
          hasMainScreenshot,
          aspect,
          frame,
          position: screenshotPosition,
          offset: screenshotOffset,
          slots: screenshotSlots,
        })
        if (!currentGroupCenter) return

        const dx = safePoint.xPct - currentGroupCenter.xPct
        const dy = safePoint.yPct - currentGroupCenter.yPct

        if (hasMainScreenshot) {
          const mainCenter = mainScreenshotPositionPct({
            aspect,
            frame,
            position: screenshotPosition,
            offset: screenshotOffset,
            slots: screenshotSlots,
          })
          setMainScreenshotPositionPreview(canvasElement, {
            xPct: clampPercent(mainCenter.xPct + dx),
            yPct: clampPercent(mainCenter.yPct + dy),
          })
        }

        for (const slot of screenshotSlots) {
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
      aspect,
      frame,
      getActiveCanvasElement,
      hasMainScreenshot,
      isBareMainTarget,
      measureMainStageDims,
      positionTarget,
      queryActiveCanvasElement,
      screenshotOffset,
      screenshotPosition,
      screenshotSlots,
      selectedAnnotationShapeId,
      selectedAssetId,
      selectedSlot,
      selectedTextId,
    ]
  )

  const positionTargetLabel =
    positionTarget === "text"
      ? "text"
      : positionTarget === "asset"
        ? "asset"
        : positionTarget === "annotation"
          ? "annotation"
          : positionTarget === "slot"
            ? "screenshot box"
            : positionTarget === "slotGroup"
              ? "screenshot boxes"
              : positionTarget === "canvas"
                ? "canvas"
                : positionTarget === "allScreenshots"
                  ? "all screenshots"
                  : positionTarget === "screenshot"
                    ? tweet
                      ? "tweet"
                      : hasDeviceFrame
                        ? "device frame"
                        : "screenshot"
                    : null

  const handleAssetUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    void readImageFileAsDataUrl(file, {
      downscaleAbove: 10 * 1024 * 1024,
      maxDimension: 1600,
    })
      .then((src) => {
        const id = addAsset(src)
        setSelectedAssetId(id)
        setSelectedTextId(null)
        setSelectedScreenshotSlotId(null)
        setIsScreenshotSelected(false)
        setActiveTool("pointer")
      })
      .catch(() => {
        toast.error("Could not read image")
      })
  }

  const handleToolClick = (id: EditorTool) => {
    if (id === "text") {
      const newId = addText()
      setSelectedTextId(newId)
      setSelectedScreenshotSlotId(null)
      setIsScreenshotSelected(false)
      setActiveTool("pointer")
      return
    }
    setActiveTool(id)
  }

  const items: {
    id: EditorTool
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: "pointer", label: "Select", icon: RiCursorLine },
    { id: "text", label: "Text", icon: RiText },
    { id: "arrow", label: "Annotate", icon: RiArrowRightUpLine },
    { id: "position", label: "Position", icon: RiDragMove2Line },
    { id: "layers", label: "Layers", icon: RiStackLine },
    { id: "enhance", label: "Enhance", icon: RiSparkling2Line },
  ]

  return (
    <>
      <input
        ref={assetInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) {
            for (const f of Array.from(files)) handleAssetUpload(f)
          }
          e.target.value = ""
        }}
      />

      <ToolbarButton
        aria-label="Add asset"
        tooltip="Add asset (image)"
        onClick={() => assetInputRef.current?.click()}
      >
        <RiImageAddLine className="size-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      {items.map((it) => {
        const isActive = activeTool === it.id
        const Icon = it.icon

        if (it.id === "layers") {
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={it.label}
              contentClassName="w-auto p-0"
              align="center"
              collisionPadding={16}
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isActive}
                  onClick={() => handleToolClick(it.id)}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <LayersPanelContent />
            </ToolbarPopover>
          )
        }

        if (it.id === "enhance") {
          const isOn = activeEnhance !== "off"
          const canEnhance = selectedSlot
            ? Boolean(selectedSlot.src)
            : Boolean(screenshot)
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={canEnhance ? "Enhance image" : "Add a screenshot first"}
              contentClassName="w-56 p-2"
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open || isOn}
                  disabled={!canEnhance}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Enhance
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {ENHANCE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setEnhance(p.id)}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-all",
                        activeEnhance === p.id
                          ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      <span
                        className="block size-6 rounded-full border border-border/60"
                        style={{
                          background: p.swatch,
                          filter: p.filter,
                        }}
                      />
                      <span className="font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </ToolbarPopover>
          )
        }

        if (it.id === "position") {
          const isDisabled = positionTarget === null
          return (
            <ToolbarPopover
              key={it.id}
              tooltip={
                isDisabled
                  ? "Nothing to position — select an element or add a screenshot"
                  : `Position ${positionTargetLabel}`
              }
              contentClassName="w-64 p-3"
              onOpenChange={(open) => {
                if (!open) setActiveTool("pointer")
              }}
              trigger={({ open }) => (
                <ToolbarButton
                  aria-label={it.label}
                  active={open}
                  disabled={isDisabled}
                  onClick={() => handleToolClick(it.id)}
                >
                  <Icon className="size-4" />
                </ToolbarButton>
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Position {positionTargetLabel}
                </span>
                {canGroupAllScreenshots ? (
                  <button
                    type="button"
                    onClick={() => setGroupAllScreenshots((v) => !v)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                      groupAllScreenshots
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                    aria-pressed={groupAllScreenshots}
                  >
                    <span className="flex items-center gap-1.5">
                      <RiGroupLine className="size-3.5" />
                      Group all screenshots
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors",
                        groupAllScreenshots ? "bg-primary" : "bg-border"
                      )}
                    >
                      <span
                        className={cn(
                          "block size-2.5 rounded-full bg-white transition-transform",
                          groupAllScreenshots && "translate-x-2.5"
                        )}
                      />
                    </span>
                  </button>
                ) : null}
                <PositionSwipeField
                  ariaLabel={`Position ${positionTargetLabel}`}
                  disabled={isDisabled}
                  value={currentPositionPoint}
                  onPreview={previewPositionPoint}
                  onChange={applyPositionPoint}
                />
              </div>
            </ToolbarPopover>
          )
        }

        return (
          <ToolbarButton
            key={it.id}
            aria-label={it.label}
            tooltip={it.label}
            active={isActive}
            onClick={() => handleToolClick(it.id)}
          >
            <Icon className="size-4" />
          </ToolbarButton>
        )
      })}

      <span className="mx-1 hidden h-5 w-px bg-border md:block" />

      <span className="hidden items-center md:flex">
        <ToolbarButton
          aria-label="Zoom out"
          tooltip={
            hasScalableContent ? "Zoom out" : "Add a screenshot or frame first"
          }
          disabled={!hasScalableContent || activeScale <= 10}
          onClick={() => {
            const nextScale = editorValueSchemas.scale
              .catch(100)
              .parse(activeScale - 10)
            if (selectedSlot) {
              updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
              return
            }
            setScale(nextScale)
          }}
        >
          <span className="text-base leading-none">−</span>
        </ToolbarButton>

        <button
          type="button"
          disabled={!hasScalableContent}
          onClick={() => {
            const resetScale = editorValueSchemas.scale.catch(100).parse(100)
            if (selectedSlot) {
              updateScreenshotSlot(selectedSlot.id, { scale: resetScale })
              return
            }
            setScale(resetScale)
          }}
          className={cn(
            "tabular min-w-[3.25rem] cursor-pointer rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent",
            !hasScalableContent && "cursor-not-allowed opacity-40"
          )}
        >
          {activeScale}%
        </button>

        <ToolbarButton
          aria-label="Zoom in"
          tooltip={
            hasScalableContent ? "Zoom in" : "Add a screenshot or frame first"
          }
          disabled={!hasScalableContent || activeScale >= 300}
          onClick={() => {
            const nextScale = editorValueSchemas.scale
              .catch(100)
              .parse(activeScale + 10)
            if (selectedSlot) {
              updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
              return
            }
            setScale(nextScale)
          }}
        >
          <span className="text-base leading-none">+</span>
        </ToolbarButton>
      </span>
    </>
  )
}
