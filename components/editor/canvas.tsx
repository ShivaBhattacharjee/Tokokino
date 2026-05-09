"use client"

import * as React from "react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { CropModal } from "@/components/editor/crop-modal"
import { AnnotationShapeElement } from "@/components/editor/annotation-shape-element"
import { AssetElementView } from "@/components/editor/asset-element"
import { TextElementView } from "@/components/editor/text-element"
import { cn } from "@/lib/utils"
import {
  effectsFilterCss,
  enhanceFilterCss,
  overlayUrl,
  shadowCss,
  shadowDropFilterCss,
  screenshotPositionAnchor,
  useEditor,
} from "@/lib/editor/store"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"

import { AnnotationLayer } from "./canvas/annotation-layer"
import { CanvasBackdrop } from "./canvas/canvas-backdrop"
import { CanvasEmptyState } from "./canvas/canvas-empty-state"
import { DeviceFrameEmptyState } from "./canvas/device-frame-empty-state"
import {
  annotationPath,
  clamp,
  deviceMockupSpec,
  positionFloatingToolbar,
  screenshotPlacementStyle,
} from "./canvas/helpers"
import { ScreenshotBare } from "./canvas/screenshot-bare"
import { ScreenshotMockup } from "./canvas/screenshot-mockup"

export function Canvas() {
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
    canvasZoom,
    screenshotPosition,
    screenshotOffset,
    screenshotLayer,
    shadow,
    overlay,
    frame,
    portrait,
    enhance,
    annotation,
    annotations,
    annotationShapes,
    canvasBorderRadius,
    isPreviewMode,
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
    addAnnotationStroke,
    updateAnnotationStroke,
    addAnnotationShape,
    updateAnnotationShape,
    deleteAnnotationShape,
    setSelectedAnnotationShapeId,
  } = useEditor()
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
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--canvas-border-radius",
      `${canvasBorderRadius}px`
    )
  }, [canvasBorderRadius])

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
  const [isScreenshotSelected, setIsScreenshotSelected] = React.useState(false)
  const [isScreenshotDragging, setIsScreenshotDragging] = React.useState(false)
  const [liveOffset, setLiveOffset] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = React.useState(false)
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

  const transform = [
    `perspective(1400px)`,
    `rotateX(${tilt.rx}deg)`,
    `rotateY(${tilt.ry}deg)`,
    `rotateZ(${tilt.rz}deg)`,
    `scale(${scale / 100})`,
  ].join(" ")
  const screenshotAnchor = screenshotPositionAnchor(screenshotPosition)

  const isPortrait = ah > aw
  const canvasMaxWidth = isPreviewMode
    ? `min(95vw, calc(90vh * ${aw} / ${ah}))`
    : isPortrait
      ? `min(${Math.round((82 * aw) / ah)}vh, ${Math.round((820 * aw) / ah)}px)`
      : "1100px"

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
    mixBlendMode: screenshotLayer.blendMode,
  }
  if (border.color && border.width > 0) {
    imgStyle.outline = `${border.width}px ${border.style || "solid"} ${border.color}`
    imgStyle.outlineOffset = `${border.padding || 0}px`
  }

  const effectsFilter = effectsFilterCss(backdrop.effects)
  const noiseEnabled = backdrop.effects.noise > 0
  const noiseOpacity = noiseEnabled ? backdrop.effects.noise / 100 : 0
  const canDragScreenshot = activeTool === "pointer" && positionedStyle
  const mockupDevice = frame.id === "none" ? null : getDeviceMockup(frame.id)
  const mockupOrientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const mockupRotation =
    frame.orientation === "horizontal" && mockupOrientation === "portrait"
      ? -90
      : 0
  const mockupAsset =
    frame.id === "none"
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

    const pointerScale = canvasZoom / 100
    let nextX =
      drag.startOffsetX + (e.clientX - drag.startClientX) / pointerScale
    let nextY =
      drag.startOffsetY + (e.clientY - drag.startClientY) / pointerScale
    const centerX = drag.baseLeft + nextX + drag.imgW / 2
    const centerY = drag.baseTop + nextY + drag.imgH / 2
    const targetX = drag.stageW / 2
    const targetY = drag.stageH / 2
    const snap = 8
    const snapX = Math.abs(centerX - targetX) <= snap
    const snapY = Math.abs(centerY - targetY) <= snap

    if (snapX) nextX += targetX - centerX
    if (snapY) nextY += targetY - centerY

    updateCenterGuides({ x: snapX, y: snapY })
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
    const pointerScale = canvasZoom / 100
    let nextX =
      drag.startOffsetX + (e.clientX - drag.startClientX) / pointerScale
    let nextY =
      drag.startOffsetY + (e.clientY - drag.startClientY) / pointerScale
    const snap = 8
    const snapX = Math.abs(nextX) <= snap
    const snapY = Math.abs(nextY) <= snap

    if (snapX) nextX = 0
    if (snapY) nextY = 0

    updateCenterGuides({ x: snapX, y: snapY })
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
    setSelectedAnnotationShapeId(null)
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    setNaturalDims({ w: el.naturalWidth, h: el.naturalHeight })
    measurePlacement()
  }

  return (
    <section
      className={cn(
        "relative z-0 flex flex-1 justify-center overflow-hidden bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center p-0"
          : "items-start border-b border-dashed border-border/70 px-2 pt-2 pb-20 sm:px-4 sm:pt-3 sm:pb-20 lg:items-center lg:px-8 lg:pt-4 lg:pb-20"
      )}
    >
      <CornerMarkers className="text-border" size={12} />
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
        className="flex w-full items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: `scale(${isPreviewMode ? 1 : canvasZoom / 100})` }}
      >
        <motion.div
          ref={canvasRef}
          initial={{ opacity: 0, scale: 0.985, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            aspectRatio,
            borderRadius: "var(--canvas-border-radius)",
            maxWidth: canvasMaxWidth,
          }}
          className="relative flex w-full items-center justify-center overflow-hidden ring-1 ring-border/60"
          onClick={() => {
            setSelectedTextId(null)
            setSelectedAssetId(null)
            setSelectedAnnotationShapeId(null)
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
              className="pointer-events-none absolute inset-y-0 left-1/2 z-30 -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {centerGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.x ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-1/2 z-50 -translate-x-1/2 border-l border-dashed border-[#9BCD64]/95"
            />
          ) : null}
          {textCenterGuides.y ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-50 -translate-y-1/2 border-t border-dashed border-[#9BCD64]/95"
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

          <div
            className="pointer-events-none relative flex h-full w-full items-center justify-center"
            style={{
              padding: screenshot || (mockupAsset && mockupSpec) ? padding : 0,
              zIndex: 60 + screenshotLayer.zIndex,
            }}
          >
            {screenshot ? (
              mockupAsset && mockupSpec ? (
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
    </section>
  )
}
