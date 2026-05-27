"use client"

import * as React from "react"

import { bulkToolbarScale } from "@/components/editor/toolbar/primitives"
import type {
  AnnotationShapeKind,
  EditorContext,
  EditorTool,
} from "@/lib/editor/store"

import type { CenterGuidesState } from "./center-guides"
import { annotationPath, clamp, positionFloatingToolbar } from "./helpers"

type AnnotationPoint = { x: number; y: number }

type EditorElementHit = {
  type: "asset" | "text" | "annotation-shape"
  id: string | null
}

type AnnotationElementMoveState = {
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
}

type AnnotationShapeDragState = {
  pointerId: number
  shapeId: string
  kind: AnnotationShapeKind
  strokeWidth: number
  startXPct: number
  startYPct: number
  nextXPct: number
  nextYPct: number
  nextWidthPct: number
  nextHeightPct: number
  nextRotation: number
  moved: boolean
}

type AnnotationStrokeDragState = {
  pointerId: number
  strokeId: string
  points: AnnotationPoint[]
}

export function useAnnotationInteractions({
  activeTool,
  canvasRef,
  annotationLayerRef,
  annotation,
  annotationShapes,
  texts,
  assets,
  bulkEditMode,
  bulkViewportZoom,
  addAnnotationStroke,
  updateAnnotationStroke,
  addAnnotationShape,
  updateAnnotationShape,
  deleteAnnotationShape,
  updateText,
  updateAsset,
  setSelectedTextId,
  setSelectedAssetId,
  setSelectedAnnotationShapeId,
  setIsScreenshotSelected,
  updateTextCenterGuides,
}: {
  activeTool: EditorTool
  canvasRef: React.RefObject<HTMLDivElement | null>
  annotationLayerRef: React.RefObject<SVGSVGElement | null>
  annotation: EditorContext["annotation"]
  annotationShapes: EditorContext["annotationShapes"]
  texts: EditorContext["texts"]
  assets: EditorContext["assets"]
  bulkEditMode: boolean
  bulkViewportZoom: number
  addAnnotationStroke: EditorContext["addAnnotationStroke"]
  updateAnnotationStroke: EditorContext["updateAnnotationStroke"]
  addAnnotationShape: EditorContext["addAnnotationShape"]
  updateAnnotationShape: EditorContext["updateAnnotationShape"]
  deleteAnnotationShape: EditorContext["deleteAnnotationShape"]
  updateText: EditorContext["updateText"]
  updateAsset: EditorContext["updateAsset"]
  setSelectedTextId: EditorContext["setSelectedTextId"]
  setSelectedAssetId: EditorContext["setSelectedAssetId"]
  setSelectedAnnotationShapeId: EditorContext["setSelectedAnnotationShapeId"]
  setIsScreenshotSelected: EditorContext["setIsScreenshotSelected"]
  updateTextCenterGuides: (next: CenterGuidesState) => void
}) {
  const annotationDragRef = React.useRef<AnnotationStrokeDragState | null>(null)
  const annotationShapeDragRef = React.useRef<AnnotationShapeDragState | null>(
    null
  )
  const annotationElementMoveRef =
    React.useRef<AnnotationElementMoveState | null>(null)

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
    (clientX: number, clientY: number): EditorElementHit | null => {
      const canvas = canvasRef.current
      const layer = annotationLayerRef.current
      if (!canvas || !layer || typeof document === "undefined") return null

      for (const element of document.elementsFromPoint(clientX, clientY)) {
        if (element === layer) continue
        if (!canvas.contains(element)) continue

        const shapeChromeElement = element.closest<HTMLElement>(
          "[data-annotation-selection-chrome-id]"
        )
        if (shapeChromeElement && canvas.contains(shapeChromeElement)) {
          return {
            type: "annotation-shape",
            id: shapeChromeElement.dataset.annotationSelectionChromeId ?? null,
          }
        }

        const shapeElement = element.closest<HTMLElement>(
          "[data-annotation-shape-id]"
        )
        if (shapeElement && canvas.contains(shapeElement)) {
          return {
            type: "annotation-shape",
            id: shapeElement.dataset.annotationShapeId ?? null,
          }
        }

        const textElement = element.closest<HTMLElement>(
          "[data-editor-text-id]"
        )
        if (textElement && canvas.contains(textElement)) {
          return {
            type: "text",
            id: textElement.dataset.editorTextId ?? null,
          }
        }

        const assetElement = element.closest<HTMLElement>(
          "[data-editor-asset-id]"
        )
        if (assetElement && canvas.contains(assetElement)) {
          return {
            type: "asset",
            id: assetElement.dataset.editorAssetId ?? null,
          }
        }
      }

      return null
    },
    [annotationLayerRef, canvasRef]
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
          new CustomEvent("tokokino:select-text", {
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

    if (annotation.mode === "step") {
      const xPct = (point.x / layer.clientWidth) * 100
      const yPct = (point.y / layer.clientHeight) * 100
      const stepNumber =
        annotationShapes.filter((s) => s.kind === "step").length + 1
      const shapeId = addAnnotationShape({
        kind: "step",
        xPct,
        yPct,
        widthPct: 0,
        heightPct: 0,
        rotation: 0,
        color: annotation.color,
        strokeWidth: 2,
        lineStyle: "solid",
        stepNumber,
      })
      setSelectedAnnotationShapeId(shapeId)
      return
    }

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
          element.getBoundingClientRect(),
          bulkEditMode ? bulkToolbarScale(bulkViewportZoom) : 1
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
          element.getBoundingClientRect(),
          bulkEditMode ? bulkToolbarScale(bulkViewportZoom) : 1
        )
      }

      const selectionChrome = canvasRef.current?.querySelector<HTMLElement>(
        `[data-annotation-selection-chrome-id="${CSS.escape(shapeDrag.shapeId)}"]`
      )
      if (selectionChrome) Object.assign(selectionChrome.style, shapeStyle)

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
    const strokePath = annotationPath(drag.points)
    const escapedStrokeId = CSS.escape(drag.strokeId)
    const parent = annotationLayerRef.current?.parentElement
    const paths = parent?.querySelectorAll<SVGPathElement>(
      `[data-annotation-stroke-id="${escapedStrokeId}"], [data-annotation-eraser-id="${escapedStrokeId}"]`
    )
    paths?.forEach((path) => path.setAttribute("d", strokePath))
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
          annotation.mode === "blur" ||
          annotation.mode === "step"
        ? "cursor-crosshair"
        : "cursor-default"

  return {
    isAnnotating,
    annotationCursor,
    getEditorElementAtPoint,
    startAnnotation,
    moveAnnotation,
    stopAnnotation,
  }
}
