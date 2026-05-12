"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { toast } from "sonner"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { CropModal } from "@/components/editor/crop-modal"
import { AnnotationShapeElement } from "@/components/editor/annotation-shape-element"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import {
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDragHandle,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  ToolbarSurface,
} from "@/components/editor/toolbar/primitives"
import { cn } from "@/lib/utils"
import { isBrowserFrame, resolveBrowserFrameColor } from "@/lib/browser-frame"
import {
  CanvasScope,
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  shadowCss,
  shadowDropFilterCss,
  screenshotPositionAnchor,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"

import { AnnotationLayer } from "./canvas/annotation-layer"
import { CanvasBackdrop } from "./canvas/canvas-backdrop"
import { BoxHoverActions } from "./canvas/box-hover-actions"
import { CanvasEmptyState } from "./canvas/canvas-empty-state"
import { DeviceFrameEmptyState } from "./canvas/device-frame-empty-state"
import { FramedScreenshotVisual } from "./canvas/framed-screenshot-visual"
import {
  annotationPath,
  clamp,
  deviceMockupSpec,
  positionFloatingToolbar,
  screenshotPlacementStyle,
  snapCenterToTarget,
} from "./canvas/helpers"
import { ScreenshotBare } from "./canvas/screenshot-bare"
import {
  BrowserFrameEmptyState,
  ScreenshotBrowserFrame,
} from "./canvas/screenshot-browser-frame"
import { ScreenshotMockup } from "./canvas/screenshot-mockup"
import { BulkCanvasFlow } from "./bulk-canvas-flow"
import { ScreenshotSlotView } from "./screenshot-slot-element"

const BASE_CANVAS_WIDTH = 1100
const SCREENSHOT_ROW_MARGIN = 1
const SCREENSHOT_ROW_GAP = 2

const screenshotRowItemWidth = (count: number) => {
  if (count <= 1) return 66
  const usableW = Math.max(
    20,
    100 - 2 * SCREENSHOT_ROW_MARGIN - (count - 1) * SCREENSHOT_ROW_GAP
  )
  return usableW / count
}

type CanvasViewProps = {
  canvasId: string
  isActive: boolean
  widthPx: number
  heightPx: number
  effectiveScale: number
  onActivate: () => void
}

function CanvasViewInner({
  isActive,
  widthPx,
  heightPx,
  effectiveScale,
  onActivate,
}: Omit<CanvasViewProps, "canvasId">) {
  const {
    activeTool,
    screenshot,
    originalScreenshot,
    lastCropRegion,
    aspect,
    background,
    padding,
    borderRadius,
    border,
    backdrop,
    tilt,
    scale,
    screenshotPosition,
    screenshotOffset,
    screenshotLayer,
    shadow,
    overlay,
    frame,
    frameAddress,
    setFrameAddress,
    portrait,
    enhance,
    annotation,
    annotations,
    annotationShapes,
    canvasBorderRadius,
    setScreenshot,
    applyCroppedScreenshot,
    setScreenshotOffset,
    texts,
    selectedTextId,
    setSelectedTextId,
    updateText,
    assets,
    updateAsset,
    setSelectedAssetId,
    screenshotSlots,
    setSelectedScreenshotSlotId,
    setScreenshotSlotImage,
    addScreenshotSlot,
    bringScreenshotToFront,
    sendScreenshotToBack,
    addAnnotationStroke,
    updateAnnotationStroke,
    addAnnotationShape,
    updateAnnotationShape,
    deleteAnnotationShape,
    setSelectedAnnotationShapeId,
    isScreenshotSelected,
    setIsScreenshotSelected,
  } = useEditor()
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const generatedAnnotationMaskId = React.useId()
  const annotationMaskId = `annotation-mask-${generatedAnnotationMaskId.replace(/:/g, "")}`
  const sortedAnnotationShapes = React.useMemo(
    () => [...annotationShapes].sort((a, b) => a.zIndex - b.zIndex),
    [annotationShapes]
  )

  React.useEffect(() => {
    if (!selectedTextId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTextId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedTextId, setSelectedTextId])

  const [isDragOver, setIsDragOver] = React.useState(false)
  const [naturalDims, setNaturalDims] = React.useState<{
    w: number
    h: number
  } | null>(null)
  const [placementDims, setPlacementDims] = React.useState<{
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  } | null>(null)
  const [isScreenshotDragging, setIsScreenshotDragging] = React.useState(false)
  const [liveOffset, setLiveOffset] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false)
  const [croppingSlotId, setCroppingSlotId] = React.useState<string | null>(
    null
  )
  const [centerGuides, setCenterGuides] = React.useState({ x: false, y: false })
  const [textCenterGuides, setTextCenterGuides] = React.useState({
    x: false,
    y: false,
  })
  const updateCenterGuides = React.useCallback(
    (next: { x: boolean; y: boolean }) => {
      setCenterGuides((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next
      )
    },
    []
  )
  const updateTextCenterGuides = React.useCallback(
    (next: { x: boolean; y: boolean }) => {
      setTextCenterGuides((prev) =>
        prev.x === next.x && prev.y === next.y ? prev : next
      )
    },
    []
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const annotationLayerRef = React.useRef<SVGSVGElement>(null)
  const [suppressTransition, setSuppressTransition] = React.useState(false)
  const prevPaddingRef = React.useRef(padding)
  React.useEffect(() => {
    if (prevPaddingRef.current === padding) return

    prevPaddingRef.current = padding
    setSuppressTransition(true)
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setSuppressTransition(false)
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [padding])
  const dragRef = React.useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
    baseLeft: number
    baseTop: number
    stageW: number
    stageH: number
    imgW: number
    imgH: number
  } | null>(null)
  const mockupDragRef = React.useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
  } | null>(null)
  const annotationDragRef = React.useRef<{
    pointerId: number
    strokeId: string
    points: { x: number; y: number }[]
    mode: "pen" | "highlight" | "eraser"
  } | null>(null)
  const annotationShapeDragRef = React.useRef<{
    pointerId: number
    shapeId: string
    kind: "arrow" | "rect" | "ellipse" | "blur"
    strokeWidth: number
    startXPct: number
    startYPct: number
    nextXPct: number
    nextYPct: number
    nextWidthPct: number
    nextHeightPct: number
    nextRotation: number
    moved: boolean
  } | null>(null)
  const annotationElementMoveRef = React.useRef<{
    pointerId: number
    type: "asset" | "text" | "annotation-shape"
    id: string
    startClientX: number
    startClientY: number
    startXPct: number
    startYPct: number
    canvasW: number
    canvasH: number
    nextXPct: number
    nextYPct: number
    moved: boolean
  } | null>(null)

  const measurePlacement = React.useCallback(() => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    const next = {
      stageW: parseFloat(getComputedStyle(stage).width) || stage.clientWidth,
      stageH: parseFloat(getComputedStyle(stage).height) || stage.clientHeight,
      imgW: image.offsetWidth,
      imgH: image.offsetHeight,
    }

    if (!next.stageW || !next.stageH || !next.imgW || !next.imgH) return

    setPlacementDims((prev) => {
      if (
        prev?.stageW === next.stageW &&
        prev.stageH === next.stageH &&
        prev.imgW === next.imgW &&
        prev.imgH === next.imgH
      ) {
        return prev
      }
      return next
    })
  }, [])

  React.useEffect(() => {
    if (!screenshot) return
    measurePlacement()

    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return

    const observer = new ResizeObserver(measurePlacement)
    observer.observe(stage)
    observer.observe(image)
    return () => observer.disconnect()
  }, [measurePlacement, screenshot])

  const readFile = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please drop an image")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshot(reader.result)
          setNaturalDims(null)
        }
      }
      reader.readAsDataURL(file)
    },
    [setScreenshot]
  )

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            readFile(file)
            e.preventDefault()
            break
          }
        }
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [readFile])

  const isAuto = aspect.id === "auto" || aspect.w === 0 || aspect.h === 0
  const autoDims = isAuto && naturalDims ? naturalDims : null
  const aw = autoDims ? autoDims.w : aspect.w || 16
  const ah = autoDims ? autoDims.h : aspect.h || 10
  const aspectRatio = `${aw} / ${ah}`
  const screenshotBoxAspect =
    frame.id === "none" && naturalDims
      ? `${naturalDims.w} / ${naturalDims.h}`
      : aw / ah < 0.85
        ? "10 / 14"
        : "16 / 10"
  const rowItemCount = screenshotSlots.length + 1
  const rowItemWidth = screenshotRowItemWidth(rowItemCount)
  const rowTotalWidth =
    rowItemWidth * rowItemCount + SCREENSHOT_ROW_GAP * (rowItemCount - 1)
  const rowStartX = 50 - rowTotalWidth / 2
  const mainScreenshotRowStyle: React.CSSProperties | null =
    screenshotSlots.length > 0
      ? {
          position: "absolute",
          left: `${rowStartX + rowItemWidth / 2}%`,
          top: "50%",
          width: `${rowItemWidth}%`,
          aspectRatio: screenshotBoxAspect,
          transform: "translate(-50%, -50%)",
          zIndex: 60 + screenshotLayer.zIndex,
        }
      : null

  const transform = [
    `perspective(1400px)`,
    `rotateX(${tilt.rx}deg)`,
    `rotateY(${tilt.ry}deg)`,
    `rotateZ(${tilt.rz}deg)`,
    `scale(${scale / 100})`,
  ].join(" ")
  const screenshotAnchor = screenshotPositionAnchor(screenshotPosition)

  const computedShadow = shadowCss(shadow)
  const computedShadowFilter = shadowDropFilterCss(shadow)
  const scaleFactor = scale / 100
  const positionX = screenshotAnchor.x / 100
  const positionY = screenshotAnchor.y / 100
  const positionedStyle: React.CSSProperties | null = placementDims
    ? screenshotPlacementStyle(placementDims, scaleFactor, positionX, positionY)
    : null
  const effectiveOffset = liveOffset ?? screenshotOffset
  const screenshotLeft =
    typeof positionedStyle?.left === "number"
      ? positionedStyle.left + effectiveOffset.x
      : undefined
  const screenshotTop =
    typeof positionedStyle?.top === "number"
      ? positionedStyle.top + effectiveOffset.y
      : undefined
  const enhanceFilter = enhanceFilterCss(enhance)
  const imgStyle: React.CSSProperties = {
    borderRadius,
    transform,
    transformStyle: "preserve-3d",
    boxShadow: computedShadow,
    filter: enhanceFilter,
    opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
  }
  if (screenshotLayer.blendMode && screenshotLayer.blendMode !== "normal") {
    imgStyle.mixBlendMode = screenshotLayer.blendMode
  }
  if (border.color && border.width > 0) {
    imgStyle.outline = `${border.width}px ${border.style || "solid"} ${border.color}`
    imgStyle.outlineOffset = `${border.padding || 0}px`
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  const canDragScreenshot = activeTool === "pointer" && positionedStyle
  const browserFrame = isBrowserFrame(frame.id)
  const browserFrameColor = resolveBrowserFrameColor(frame.color)
  const mockupDevice =
    frame.id === "none" || browserFrame ? null : getDeviceMockup(frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const mockupRotation =
    frame.orientation === "horizontal" && mockupOrientation === "portrait"
      ? -90
      : 0
  const mockupAsset =
    frame.id === "none" || browserFrame
      ? null
      : getDeviceMockupAsset(frame.id, frame.color, mockupOrientation)
  const mockupSpec = mockupAsset ? deviceMockupSpec(frame.id) : null

  const startScreenshotDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!canDragScreenshot || !placementDims) return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsScreenshotSelected(true)
    setIsScreenshotDragging(true)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: screenshotOffset.x,
      startOffsetY: screenshotOffset.y,
      baseLeft: positionedStyle.left as number,
      baseTop: positionedStyle.top as number,
      stageW: placementDims.stageW,
      stageH: placementDims.stageH,
      imgW: placementDims.imgW,
      imgH: placementDims.imgH,
    }
  }

  const moveScreenshot = (e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    e.preventDefault()

    const pointerScale = effectiveScale
    let nextX =
      drag.startOffsetX + (e.clientX - drag.startClientX) / pointerScale
    let nextY =
      drag.startOffsetY + (e.clientY - drag.startClientY) / pointerScale
    const centerX = drag.baseLeft + nextX + drag.imgW / 2
    const centerY = drag.baseTop + nextY + drag.imgH / 2
    const targetX = drag.stageW / 2
    const targetY = drag.stageH / 2
    const snap = snapCenterToTarget({ centerX, centerY, targetX, targetY })

    nextX += snap.deltaX
    nextY += snap.deltaY

    updateCenterGuides(snap.guides)
    setLiveOffset({ x: nextX, y: nextY })
  }

  const stopScreenshotDrag = (e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    dragRef.current = null
    setIsScreenshotDragging(false)
    updateCenterGuides({ x: false, y: false })
    if (liveOffset) {
      setScreenshotOffset(liveOffset)
      setLiveOffset(null)
    }
  }

  const startMockupDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "pointer") return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsScreenshotSelected(true)
    setIsScreenshotDragging(true)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
    mockupDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: screenshotOffset.x,
      startOffsetY: screenshotOffset.y,
    }
  }

  const moveMockup = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = mockupDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    e.preventDefault()
    const pointerScale = effectiveScale
    let nextX =
      drag.startOffsetX + (e.clientX - drag.startClientX) / pointerScale
    let nextY =
      drag.startOffsetY + (e.clientY - drag.startClientY) / pointerScale
    const snap = snapCenterToTarget({
      centerX: nextX,
      centerY: nextY,
      targetX: 0,
      targetY: 0,
    })

    nextX += snap.deltaX
    nextY += snap.deltaY

    updateCenterGuides(snap.guides)
    setLiveOffset({ x: nextX, y: nextY })
  }

  const stopMockupDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = mockupDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    mockupDragRef.current = null
    setIsScreenshotDragging(false)
    updateCenterGuides({ x: false, y: false })
    if (liveOffset) {
      setScreenshotOffset(liveOffset)
      setLiveOffset(null)
    }
  }

  const getAnnotationPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const layer = annotationLayerRef.current
    if (!layer) return null
    const rect = layer.getBoundingClientRect()
    const width = layer.clientWidth
    const height = layer.clientHeight
    if (!rect.width || !rect.height || !width || !height) return null
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    }
  }

  const getEditorElementAtPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      const layer = annotationLayerRef.current
      if (!canvas || !layer || typeof document === "undefined") return null

      for (const element of document.elementsFromPoint(clientX, clientY)) {
        if (element === layer) continue
        if (!canvas.contains(element)) continue

        const shapeElement = element.closest<HTMLElement>(
          "[data-annotation-shape-id]"
        )
        if (shapeElement && canvas.contains(shapeElement)) {
          return {
            type: "annotation-shape" as const,
            id: shapeElement.dataset.annotationShapeId ?? null,
          }
        }

        const textElement = element.closest<HTMLElement>(
          "[data-editor-text-id]"
        )
        if (textElement && canvas.contains(textElement)) {
          return {
            type: "text" as const,
            id: textElement.dataset.editorTextId ?? null,
          }
        }

        const assetElement = element.closest<HTMLElement>(
          "[data-editor-asset-id]"
        )
        if (assetElement && canvas.contains(assetElement)) {
          return {
            type: "asset" as const,
            id: assetElement.dataset.editorAssetId ?? null,
          }
        }
      }

      return null
    },
    []
  )

  const startAnnotation = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool !== "arrow") return
    const editorElementAtPoint = getEditorElementAtPoint(e.clientX, e.clientY)
    if (editorElementAtPoint?.id) {
      const canvas = canvasRef.current
      const movable =
        editorElementAtPoint.type === "annotation-shape"
          ? annotationShapes.find(
              (shape) => shape.id === editorElementAtPoint.id
            )
          : editorElementAtPoint.type === "text"
            ? texts.find((text) => text.id === editorElementAtPoint.id)
            : assets.find((asset) => asset.id === editorElementAtPoint.id)

      if (!movable) return

      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)

      if (editorElementAtPoint.type === "annotation-shape") {
        setSelectedAnnotationShapeId(editorElementAtPoint.id)
        setSelectedTextId(null)
        setSelectedAssetId(null)
      } else if (editorElementAtPoint.type === "text") {
        window.dispatchEvent(
          new CustomEvent("beautiful-screenshots:select-text", {
            detail: { id: editorElementAtPoint.id },
          })
        )
        setSelectedTextId(editorElementAtPoint.id)
        setSelectedAnnotationShapeId(null)
        setSelectedAssetId(null)
      } else {
        setSelectedAssetId(editorElementAtPoint.id)
        setSelectedTextId(null)
        setSelectedAnnotationShapeId(null)
      }

      setIsScreenshotSelected(false)
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        annotationElementMoveRef.current = {
          pointerId: e.pointerId,
          type: editorElementAtPoint.type,
          id: editorElementAtPoint.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startXPct: movable.xPct,
          startYPct: movable.yPct,
          canvasW: rect.width,
          canvasH: rect.height,
          nextXPct: movable.xPct,
          nextYPct: movable.yPct,
          moved: false,
        }
      }
      return
    }

    const point = getAnnotationPoint(e)
    if (!point) return
    const layer = annotationLayerRef.current
    if (!layer) return

    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setIsScreenshotSelected(false)

    if (
      annotation.mode === "arrow" ||
      annotation.mode === "rect" ||
      annotation.mode === "ellipse" ||
      annotation.mode === "blur"
    ) {
      const startXPct = (point.x / layer.clientWidth) * 100
      const startYPct = (point.y / layer.clientHeight) * 100
      const shapeId = addAnnotationShape({
        kind: annotation.mode,
        xPct: startXPct,
        yPct: startYPct,
        widthPct: 1,
        heightPct: 1,
        rotation: 0,
        color: annotation.mode === "blur" ? "#0a0a0a" : annotation.color,
        strokeWidth: annotation.strokeWidth,
        lineStyle: annotation.lineStyle,
        ...(annotation.mode === "blur"
          ? {
              blurEffect: annotation.blurEffect,
              blurAmount: annotation.blurAmount,
            }
          : {}),
      })
      setSelectedAnnotationShapeId(shapeId)
      annotationShapeDragRef.current = {
        pointerId: e.pointerId,
        shapeId,
        kind: annotation.mode,
        strokeWidth: annotation.strokeWidth,
        startXPct,
        startYPct,
        nextXPct: startXPct,
        nextYPct: startYPct,
        nextWidthPct: 1,
        nextHeightPct: 1,
        nextRotation: 0,
        moved: false,
      }
      return
    }

    if (
      annotation.mode === "pen" ||
      annotation.mode === "highlight" ||
      annotation.mode === "eraser"
    ) {
      const strokeId = addAnnotationStroke({
        mode: annotation.mode,
        color: annotation.color,
        strokeWidth: annotation.strokeWidth,
        points: [point],
      })
      annotationDragRef.current = {
        pointerId: e.pointerId,
        strokeId,
        points: [point],
        mode: annotation.mode,
      }
    }
  }

  const moveAnnotation = (e: React.PointerEvent<SVGSVGElement>) => {
    const elementMove = annotationElementMoveRef.current
    if (elementMove && elementMove.pointerId === e.pointerId) {
      e.preventDefault()
      e.stopPropagation()
      const rawDx = e.clientX - elementMove.startClientX
      const rawDy = e.clientY - elementMove.startClientY
      if (!elementMove.moved && Math.hypot(rawDx, rawDy) < 4) return
      elementMove.moved = true
      let nextX = elementMove.startXPct + (rawDx / elementMove.canvasW) * 100
      let nextY = elementMove.startYPct + (rawDy / elementMove.canvasH) * 100
      const snapX = Math.abs(nextX - 50) <= (8 / elementMove.canvasW) * 100
      const snapY = Math.abs(nextY - 50) <= (8 / elementMove.canvasH) * 100
      if (snapX) nextX = 50
      if (snapY) nextY = 50
      const min = elementMove.type === "asset" ? 0 : -20
      const max = elementMove.type === "asset" ? 100 : 120
      elementMove.nextXPct = clamp(nextX, min, max)
      elementMove.nextYPct = clamp(nextY, min, max)

      const selector =
        elementMove.type === "annotation-shape"
          ? `[data-annotation-shape-id="${CSS.escape(elementMove.id)}"]`
          : elementMove.type === "text"
            ? `[data-editor-text-id="${CSS.escape(elementMove.id)}"]`
            : `[data-editor-asset-id="${CSS.escape(elementMove.id)}"]`
      const element = canvasRef.current?.querySelector<HTMLElement>(selector)
      if (element) {
        element.style.left = `${elementMove.nextXPct}%`
        element.style.top = `${elementMove.nextYPct}%`
        positionFloatingToolbar(
          `${elementMove.type}:${elementMove.id}`,
          element.getBoundingClientRect()
        )
      }

      if (elementMove.type === "annotation-shape") {
        const selectionChrome = canvasRef.current?.querySelector<HTMLElement>(
          `[data-annotation-selection-chrome-id="${CSS.escape(elementMove.id)}"]`
        )
        if (selectionChrome) {
          selectionChrome.style.left = `${elementMove.nextXPct}%`
          selectionChrome.style.top = `${elementMove.nextYPct}%`
        }
      }
      updateTextCenterGuides({ x: snapX, y: snapY })
      return
    }

    const shapeDrag = annotationShapeDragRef.current
    if (shapeDrag && shapeDrag.pointerId === e.pointerId) {
      const point = getAnnotationPoint(e)
      const layer = annotationLayerRef.current
      if (!point || !layer) return
      e.preventDefault()
      e.stopPropagation()
      const endXPct = (point.x / layer.clientWidth) * 100
      const endYPct = (point.y / layer.clientHeight) * 100
      const xPct = (shapeDrag.startXPct + endXPct) / 2
      const yPct = (shapeDrag.startYPct + endYPct) / 2
      const snapX = Math.abs(xPct - 50) <= (8 / layer.clientWidth) * 100
      const snapY = Math.abs(yPct - 50) <= (8 / layer.clientHeight) * 100

      const isArrow = shapeDrag.kind === "arrow"
      let widthPct: number
      let heightPct: number
      let rotation = 0

      if (isArrow) {
        const dxPx = ((endXPct - shapeDrag.startXPct) / 100) * layer.clientWidth
        const dyPx =
          ((endYPct - shapeDrag.startYPct) / 100) * layer.clientHeight
        const distancePx = Math.hypot(dxPx, dyPx)
        const minArrowWidthPx = Math.max(56, shapeDrag.strokeWidth * 12)
        widthPct =
          (Math.max(minArrowWidthPx, distancePx) / layer.clientWidth) * 100
        const arrowHeightPx = Math.max(56, shapeDrag.strokeWidth * 14)
        heightPct = (arrowHeightPx / layer.clientHeight) * 100
        rotation =
          distancePx > 0.5 ? (Math.atan2(dyPx, dxPx) * 180) / Math.PI : 0
      } else {
        widthPct = Math.max(1, Math.abs(endXPct - shapeDrag.startXPct))
        heightPct = Math.max(1, Math.abs(endYPct - shapeDrag.startYPct))
      }

      shapeDrag.nextXPct = snapX ? 50 : xPct
      shapeDrag.nextYPct = snapY ? 50 : yPct
      shapeDrag.nextWidthPct = widthPct
      shapeDrag.nextHeightPct = heightPct
      shapeDrag.nextRotation = rotation

      const selector = `[data-annotation-shape-id="${CSS.escape(shapeDrag.shapeId)}"]`
      const element = canvasRef.current?.querySelector<HTMLElement>(selector)
      const shapeStyle = {
        left: `${shapeDrag.nextXPct}%`,
        top: `${shapeDrag.nextYPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
      if (element) {
        Object.assign(element.style, shapeStyle)
        positionFloatingToolbar(
          `annotation-shape:${shapeDrag.shapeId}`,
          element.getBoundingClientRect()
        )
      }

      const selectionChrome = canvasRef.current?.querySelector<HTMLElement>(
        `[data-annotation-selection-chrome-id="${CSS.escape(shapeDrag.shapeId)}"]`
      )
      if (selectionChrome) {
        Object.assign(selectionChrome.style, shapeStyle)
      }

      updateTextCenterGuides({ x: snapX, y: snapY })
      shapeDrag.moved = true
      return
    }

    const drag = annotationDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const point = getAnnotationPoint(e)
    if (!point) return

    e.preventDefault()
    e.stopPropagation()

    const last = drag.points[drag.points.length - 1]
    const dx = point.x - last.x
    const dy = point.y - last.y
    if (dx * dx + dy * dy < 1) return

    drag.points = [...drag.points, point]
    const path = annotationLayerRef.current?.querySelector<SVGPathElement>(
      `[data-annotation-stroke-id="${CSS.escape(drag.strokeId)}"]`
    )
    if (path) path.setAttribute("d", annotationPath(drag.points))
  }

  const stopAnnotation = (e: React.PointerEvent<SVGSVGElement>) => {
    const elementMove = annotationElementMoveRef.current
    if (elementMove && elementMove.pointerId === e.pointerId) {
      annotationElementMoveRef.current = null
      if (elementMove.moved) {
        const patch = {
          xPct: elementMove.nextXPct,
          yPct: elementMove.nextYPct,
        }
        if (elementMove.type === "annotation-shape") {
          updateAnnotationShape(elementMove.id, patch)
        } else if (elementMove.type === "text") {
          updateText(elementMove.id, patch)
        } else {
          updateAsset(elementMove.id, patch)
        }
      }
      updateTextCenterGuides({ x: false, y: false })
      return
    }

    const shapeDrag = annotationShapeDragRef.current
    if (shapeDrag && shapeDrag.pointerId === e.pointerId) {
      annotationShapeDragRef.current = null
      if (!shapeDrag.moved) {
        deleteAnnotationShape(shapeDrag.shapeId)
        setSelectedAnnotationShapeId(null)
      } else {
        updateAnnotationShape(shapeDrag.shapeId, {
          xPct: shapeDrag.nextXPct,
          yPct: shapeDrag.nextYPct,
          widthPct: shapeDrag.nextWidthPct,
          heightPct: shapeDrag.nextHeightPct,
          rotation: shapeDrag.nextRotation,
        })
      }
      updateTextCenterGuides({ x: false, y: false })
      return
    }

    const drag = annotationDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    annotationDragRef.current = null
    updateAnnotationStroke(drag.strokeId, drag.points)
  }

  const isAnnotating = activeTool === "arrow"
  const annotationCursor =
    annotation.mode === "eraser"
      ? "cursor-cell"
      : annotation.mode === "pen" ||
          annotation.mode === "highlight" ||
          annotation.mode === "blur"
        ? "cursor-crosshair"
        : "cursor-default"

  const handleScreenshotClickSelect = (e: { stopPropagation: () => void }) => {
    if (activeTool !== "pointer") return
    e.stopPropagation()
    setIsScreenshotSelected(true)
    setSelectedTextId(null)
    setSelectedAssetId(null)
    setSelectedAnnotationShapeId(null)
    setSelectedScreenshotSlotId(null)
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    setNaturalDims({ w: el.naturalWidth, h: el.naturalHeight })
    measurePlacement()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) readFile(f)
          e.target.value = ""
        }}
      />

      <div
        className="flex items-center justify-center"
        style={{ width: widthPx, height: heightPx }}
      >
        <motion.div
          ref={canvasRef}
          initial={{ opacity: 0, scale: 0.985, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            aspectRatio,
            borderRadius: canvasBorderRadius,
            width: widthPx,
            height: heightPx,
          }}
          className={cn(
            "relative flex items-center justify-center overflow-hidden ring-1 ring-border/60 transition-shadow",
            bulkEditMode && isActive
              ? "shadow-[0_0_0_4px_rgba(120,90,255,0.12)] ring-2 ring-primary/70"
              : "ring-border/40"
          )}
          onClick={() => {
            if (!isActive) {
              onActivate()
              return
            }
            setSelectedTextId(null)
            setSelectedAssetId(null)
            setSelectedAnnotationShapeId(null)
            setSelectedScreenshotSlotId(null)
            setIsScreenshotSelected(false)
          }}
          onPointerDownCapture={() => {
            if (!isActive) onActivate()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) readFile(file)
          }}
        >
          {centerGuides.x ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 z-[900] -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {centerGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[900] -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.x ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 z-[900] -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-[900] -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
            />
          ) : null}

          <CanvasBackdrop
            background={background}
            backdrop={backdrop}
            effectsFilter={effectsFilter}
            noiseEnabled={noiseEnabled}
            noiseOpacity={noiseOpacity}
            portrait={portrait}
            overlay={overlay}
          />

          {mainScreenshotRowStyle ? (
            <MainScreenshotRowItem
              style={mainScreenshotRowStyle}
              offset={effectiveOffset}
              screenshot={screenshot}
              frame={frame}
              addressValue={frameAddress}
              onAddressChange={setFrameAddress}
              transform={transform}
              isDragOver={isDragOver}
              imgStyle={imgStyle}
              shadowFilter={computedShadowFilter}
              filterChain={enhanceFilter}
              isSelected={isScreenshotSelected}
              activeTool={activeTool}
              isScreenshotDragging={isScreenshotDragging}
              onSelect={handleScreenshotClickSelect}
              onBrowse={() => fileInputRef.current?.click()}
              onCropClick={() => setIsCropModalOpen(true)}
              onReplaceFile={readFile}
              onDelete={() => {
                setIsScreenshotSelected(false)
                setScreenshot(null)
              }}
              onDuplicate={() => {
                const newId = addScreenshotSlot()
                if (!newId) {
                  toast(`Screenshot box limit reached`)
                  return
                }
                if (screenshot) setScreenshotSlotImage(newId, screenshot)
                setSelectedScreenshotSlotId(newId)
                setIsScreenshotSelected(false)
              }}
              onBringToFront={() => bringScreenshotToFront()}
              onSendToBack={() => sendScreenshotToBack()}
              onPointerDown={(e) => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur()
                }
                startMockupDrag(e)
              }}
              onPointerMove={moveMockup}
              onPointerUp={stopMockupDrag}
            />
          ) : null}

          <div
            className={cn(
              "pointer-events-none flex items-center justify-center",
              mainScreenshotRowStyle
                ? "hidden"
                : "relative h-full w-full"
            )}
            style={
              mainScreenshotRowStyle
                ? undefined
                : {
                    padding: `${(padding / 1200) * 100}%`,
                    zIndex: 60 + screenshotLayer.zIndex,
                  }
            }
          >
            {screenshot ? (
              browserFrame ? (
                <ScreenshotBrowserFrame
                  screenshot={screenshot}
                  frameId={frame.id}
                  color={browserFrameColor}
                  screenshotLayer={screenshotLayer}
                  transform={transform}
                  shadowFilter={computedShadowFilter}
                  screenshotOffset={effectiveOffset}
                  screenshotAnchor={screenshotAnchor}
                  enhanceFilter={enhanceFilter}
                  isScreenshotDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  stageRef={stageRef}
                  imageRef={imageRef}
                  addressValue={frameAddress}
                  onAddressChange={setFrameAddress}
                  onSelect={handleScreenshotClickSelect}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                  onImageLoad={handleImageLoad}
                  onCropClick={() => setIsCropModalOpen(true)}
                  onReplaceFile={readFile}
                  onDelete={() => {
                    setIsScreenshotSelected(false)
                    setScreenshot(null)
                  }}
                />
              ) : mockupAsset && mockupSpec ? (
                <ScreenshotMockup
                  screenshot={screenshot}
                  mockupAsset={mockupAsset}
                  mockupSpec={mockupSpec}
                  screenshotLayer={screenshotLayer}
                  transform={transform}
                  mockupRotation={mockupRotation}
                  shadowFilter={computedShadowFilter}
                  screenshotOffset={effectiveOffset}
                  screenshotAnchor={screenshotAnchor}
                  enhanceFilter={enhanceFilter}
                  isScreenshotDragging={isScreenshotDragging}
                  activeTool={activeTool}
                  placementDims={placementDims}
                  stageRef={stageRef}
                  imageRef={imageRef}
                  onSelect={handleScreenshotClickSelect}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    startMockupDrag(e)
                  }}
                  onPointerMove={moveMockup}
                  onPointerUp={stopMockupDrag}
                  onImageLoad={handleImageLoad}
                  onCropClick={() => setIsCropModalOpen(true)}
                  onReplaceFile={readFile}
                  onDelete={() => {
                    setIsScreenshotSelected(false)
                    setScreenshot(null)
                  }}
                />
              ) : (
                <ScreenshotBare
                  screenshot={screenshot}
                  imgStyle={imgStyle}
                  positionedStyle={positionedStyle}
                  transform={transform}
                  screenshotLeft={screenshotLeft}
                  screenshotTop={screenshotTop}
                  placementDims={placementDims}
                  screenshotLayer={screenshotLayer}
                  isScreenshotSelected={isScreenshotSelected}
                  isScreenshotDragging={isScreenshotDragging}
                  suppressTransition={suppressTransition}
                  activeTool={activeTool}
                  selectedTextId={selectedTextId}
                  stageRef={stageRef}
                  imageRef={imageRef}
                  onContainerPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsScreenshotSelected(false)
                    }
                  }}
                  onSelect={handleScreenshotClickSelect}
                  onPointerDown={(e) => {
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur()
                    }
                    setSelectedTextId(null)
                    setSelectedAnnotationShapeId(null)
                    startScreenshotDrag(e)
                  }}
                  onPointerMove={moveScreenshot}
                  onPointerUp={stopScreenshotDrag}
                  onImageLoad={handleImageLoad}
                  onCropClick={() => setIsCropModalOpen(true)}
                  onReplaceFile={readFile}
                  onDelete={() => {
                    setIsScreenshotSelected(false)
                    setScreenshot(null)
                  }}
                />
              )
            ) : browserFrame ? (
              <BrowserFrameEmptyState
                frameId={frame.id}
                color={browserFrameColor}
                isDragOver={isDragOver}
                onBrowse={() => fileInputRef.current?.click()}
                transform={transform}
                screenshotOffset={effectiveOffset}
                screenshotAnchor={screenshotAnchor}
                isScreenshotDragging={isScreenshotDragging}
                activeTool={activeTool}
                addressValue={frameAddress}
                onAddressChange={setFrameAddress}
                onPointerDown={(e) => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  startMockupDrag(e)
                }}
                onPointerMove={moveMockup}
                onPointerUp={stopMockupDrag}
              />
            ) : mockupAsset && mockupSpec ? (
              <DeviceFrameEmptyState
                mockupAsset={mockupAsset}
                mockupSpec={mockupSpec}
                isDragOver={isDragOver}
                onBrowse={() => fileInputRef.current?.click()}
                transform={transform}
                mockupRotation={mockupRotation}
                screenshotOffset={effectiveOffset}
                screenshotAnchor={screenshotAnchor}
                isScreenshotDragging={isScreenshotDragging}
                activeTool={activeTool}
                onPointerDown={(e) => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur()
                  }
                  startMockupDrag(e)
                }}
                onPointerMove={moveMockup}
                onPointerUp={stopMockupDrag}
              />
            ) : (
              <CanvasEmptyState
                isDragOver={isDragOver}
                onBrowse={() => fileInputRef.current?.click()}
                previewStyle={imgStyle}
              />
            )}
          </div>

          {overlay.id !== null && overlay.position === "overlay" ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url("${overlayUrl(overlay.id)}")`,
                opacity: overlay.opacity / 100,
                zIndex: 30,
              }}
            />
          ) : null}

          {assets.map((a) => (
            <AssetElementView key={a.id} asset={a} canvasRef={canvasRef} />
          ))}

          {screenshotSlots.map((slot) => (
            <ScreenshotSlotView
              key={slot.id}
              slot={slot}
              canvasRef={canvasRef}
              canvasAspectRatio={aw / ah}
              onCropRequest={(id) => setCroppingSlotId(id)}
              onCenterGuideChange={updateCenterGuides}
            />
          ))}

          {texts.map((t) => (
            <TextElementView
              key={t.id}
              text={t}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
            />
          ))}

          {sortedAnnotationShapes.map((shape) => (
            <AnnotationShapeElement
              key={shape.id}
              shape={shape}
              canvasRef={canvasRef}
              onCenterGuideChange={updateTextCenterGuides}
            />
          ))}

          <AnnotationLayer
            layerRef={annotationLayerRef}
            annotations={annotations}
            annotationMaskId={annotationMaskId}
            isAnnotating={isAnnotating}
            cursorClass={annotationCursor}
            onPointerDown={startAnnotation}
            onPointerMove={moveAnnotation}
            onPointerUp={stopAnnotation}
            onClick={(e) => {
              if (isAnnotating) e.stopPropagation()
            }}
            onDoubleClick={(e) => {
              if (!isAnnotating) return
              const editorElementAtPoint = getEditorElementAtPoint(
                e.clientX,
                e.clientY
              )
              if (
                editorElementAtPoint?.type !== "text" ||
                !editorElementAtPoint.id
              ) {
                return
              }

              e.preventDefault()
              e.stopPropagation()
              window.dispatchEvent(
                new CustomEvent("beautiful-screenshots:edit-text", {
                  detail: { id: editorElementAtPoint.id },
                })
              )
            }}
          />
        </motion.div>
      </div>

      <CropModal
        open={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        screenshotUrl={originalScreenshot ?? screenshot}
        initialRegion={lastCropRegion}
        onCrop={applyCroppedScreenshot}
      />

      <CropModal
        open={croppingSlotId !== null}
        onOpenChange={(open) => {
          if (!open) setCroppingSlotId(null)
        }}
        screenshotUrl={
          croppingSlotId
            ? (screenshotSlots.find((s) => s.id === croppingSlotId)?.src ?? null)
            : null
        }
        onCrop={(cropped) => {
          if (croppingSlotId) {
            setScreenshotSlotImage(croppingSlotId, cropped)
            setCroppingSlotId(null)
          }
        }}
      />
    </>
  )
}

type MainScreenshotRowItemProps = {
  style: React.CSSProperties
  offset: { x: number; y: number }
  screenshot: string | null
  frame: import("@/lib/editor/state-types").DeviceFrame
  addressValue: string
  onAddressChange: (value: string) => void
  transform: string
  isDragOver: boolean
  imgStyle: React.CSSProperties
  shadowFilter: string | undefined
  filterChain: string | undefined
  isSelected: boolean
  activeTool: import("@/lib/editor/store").EditorTool
  isScreenshotDragging: boolean
  onSelect: (e: React.MouseEvent | React.PointerEvent) => void
  onBrowse: () => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onDuplicate: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

function MainScreenshotRowItem({
  style,
  offset,
  screenshot,
  frame,
  addressValue,
  onAddressChange,
  transform,
  isDragOver,
  imgStyle,
  shadowFilter,
  filterChain,
  isSelected,
  activeTool,
  isScreenshotDragging,
  onSelect,
  onBrowse,
  onCropClick,
  onReplaceFile,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: MainScreenshotRowItemProps) {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (!isSelected || activeTool !== "pointer" || !rowRef.current) {
      setToolbarRect(null)
      return
    }
    const el = rowRef.current
    const update = () => setToolbarRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [isSelected, activeTool])

  React.useEffect(() => {
    if (!isSelected || activeTool !== "pointer" || !rowRef.current) return
    setToolbarRect(rowRef.current.getBoundingClientRect())
  }, [isSelected, activeTool, offset.x, offset.y, style.left, style.top])

  const baseTransform = (style.transform as string | undefined) ?? ""
  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: `${baseTransform} translate(${offset.x}px, ${offset.y}px)`.trim(),
  }
  return (
    <>
      <div
        ref={rowRef}
        className={cn(
          "group/main-row pointer-events-auto",
          activeTool === "pointer" && "cursor-grab",
          isScreenshotDragging && "cursor-grabbing"
        )}
        style={mergedStyle}
        onClick={onSelect}
        onPointerDown={(e) => {
          if (activeTool !== "pointer") return
          e.stopPropagation()
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={cn(
            "relative h-full w-full",
            isSelected &&
              activeTool === "pointer" &&
              "outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
          )}
          style={{
            transform,
            transformStyle: "preserve-3d",
            opacity: imgStyle.opacity as number | undefined,
            mixBlendMode: imgStyle.mixBlendMode as React.CSSProperties["mixBlendMode"],
            borderRadius: imgStyle.borderRadius as number | undefined,
            boxShadow:
              frame.id === "none"
                ? (imgStyle.boxShadow as string | undefined)
                : undefined,
          }}
        >
          <FramedScreenshotVisual
            src={screenshot}
            frame={frame}
            onBrowse={onBrowse}
            isDragOver={isDragOver}
            imageFilter={filterChain}
            shadowFilter={frame.id === "none" ? undefined : shadowFilter}
            borderRadius={imgStyle.borderRadius as number | undefined}
            addressValue={addressValue}
            onAddressChange={onAddressChange}
          />

          {screenshot && activeTool === "pointer" ? (
            <BoxHoverActions
              hoverGroupClass="group-hover/main-row:opacity-100"
              onCrop={onCropClick}
              onReplaceFile={onReplaceFile}
              onDelete={onDelete}
            />
          ) : null}
        </div>
      </div>

      {isSelected &&
      activeTool === "pointer" &&
      toolbarRect &&
      typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              return (
                <div
                  data-editor-floating-toolbar-target="main-screenshot"
                  className="pointer-events-none fixed z-100"
                  style={{
                    top,
                    left,
                    transform: flipBelow
                      ? "translate(-50%, 0)"
                      : "translate(-50%, -100%)",
                  }}
                >
                  <div className="pointer-events-auto">
                    <ToolbarSurface>
                      <ToolbarDragHandle
                        ariaLabel="Drag screenshot"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onPointerDown(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }}
                        onPointerMove={(e) =>
                          onPointerMove(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }
                        onPointerUp={(e) =>
                          onPointerUp(
                            e as unknown as React.PointerEvent<HTMLDivElement>
                          )
                        }
                      />
                      <ToolbarDivider />
                      <ToolbarDuplicateButton
                        ariaLabel="Duplicate screenshot"
                        onDuplicate={onDuplicate}
                      />
                      <ToolbarLayerOrderMenu
                        onBringToFront={onBringToFront}
                        onSendToBack={onSendToBack}
                      />
                    </ToolbarSurface>
                  </div>
                </div>
              )
            })(),
            document.body
          )
        : null}
    </>
  )
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <CanvasScope id={props.canvasId}>
      <CanvasViewInner
        isActive={props.isActive}
        widthPx={props.widthPx}
        heightPx={props.heightPx}
        effectiveScale={props.effectiveScale}
        onActivate={props.onActivate}
      />
    </CanvasScope>
  )
}

export function Canvas() {
  const canvases = useEditorStore((s) => s.present.canvases)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const aspect = useEditorStore((s) => s.present.aspect)
  const canvasZoom = useEditorStore((s) => s.present.canvasZoom)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const setActiveCanvasId = useEditorStore((s) => s.setActiveCanvasId)
  const setSelectedTextId = useEditorStore((s) => s.setSelectedTextId)
  const setSelectedAssetId = useEditorStore((s) => s.setSelectedAssetId)
  const setSelectedAnnotationShapeId = useEditorStore(
    (s) => s.setSelectedAnnotationShapeId
  )
  const setSelectedScreenshotSlotId = useEditorStore(
    (s) => s.setSelectedScreenshotSlotId
  )

  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const widthPx = BASE_CANVAS_WIDTH
  const heightPx = (BASE_CANVAS_WIDTH * ah) / aw

  const zoomScale = isPreviewMode ? 1 : canvasZoom / 100

  const sectionRef = React.useRef<HTMLElement | null>(null)
  const [autoFit, setAutoFit] = React.useState(0.6)
  const topGutter = 24
  const bottomGutter = 96
  const verticalOffset = (topGutter - bottomGutter) / 2
  React.useLayoutEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const hGutter = 48
      const fitW = Math.max(0, rect.width - hGutter) / widthPx
      const fitH =
        Math.max(0, rect.height - topGutter - bottomGutter) / heightPx
      setAutoFit(Math.max(0.05, Math.min(1, Math.min(fitW, fitH))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [widthPx, heightPx, topGutter, bottomGutter])

  const effectiveScale = autoFit * zoomScale

  const isBulkScroll = bulkEditMode && !isPreviewMode

  return (
    <section
      ref={sectionRef}
      style={{ containerType: "size" }}
      className={cn(
        "relative z-0 flex flex-1 overflow-hidden bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center justify-center p-0"
          : "border-b border-dashed border-border/70"
      )}
      onClick={() => {
        setSelectedTextId(null)
        setSelectedAssetId(null)
        setSelectedAnnotationShapeId(null)
        setSelectedScreenshotSlotId(null)
      }}
    >
      <CornerMarkers className="text-border" size={12} />

      {isBulkScroll ? (
        <BulkCanvasFlow widthPx={widthPx} heightPx={heightPx} />
      ) : (
        <div
          className="absolute top-1/2 left-1/2 origin-center transition-transform duration-200 ease-out"
          style={{
            transform: `translate(-50%, calc(-50% + ${verticalOffset}px)) scale(${effectiveScale})`,
          }}
        >
          <div className="relative">
            {canvases.map((canvas) => {
              const isActive = canvas.id === activeCanvasId
              return (
                <div
                  key={canvas.id}
                  className="absolute"
                  style={{
                    left: canvas.position.x,
                    top: canvas.position.y,
                    transform: "translate(-50%, -50%)",
                    zIndex: isActive ? 10 : 0,
                  }}
                >
                  <CanvasView
                    canvasId={canvas.id}
                    isActive={isActive}
                    widthPx={widthPx}
                    heightPx={heightPx}
                    effectiveScale={effectiveScale}
                    onActivate={() => setActiveCanvasId(canvas.id)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
