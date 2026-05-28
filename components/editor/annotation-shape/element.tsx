"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiRefreshLine } from "@remixicon/react"

import { type AnnotationShape, useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"
import {
  bulkToolbarScale,
  floatingToolbarTransform,
} from "@/components/editor/toolbar/primitives"
import { useFloatingToolbarRect } from "@/hooks/use-floating-toolbar-rect"

import {
  ARROW_ENDPOINT_HANDLES,
  HANDLE_CLASS,
  RESIZE_HANDLES,
  type ResizeHandleId,
} from "./constants"
import {
  clamp,
  getArrowEndpoints,
  getArrowGeometry,
  lineDashArray,
  scaledLineDashArray,
} from "./geometry"
import { BlurRedactionShape } from "./previews"
import { AnnotationShapeToolbar } from "./toolbar"

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
  nextXPct: number
  nextYPct: number
  moved: boolean
}

type ResizeState = {
  pointerId: number
  handle: ResizeHandleId
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  startWidthPct: number
  startHeightPct: number
  canvasW: number
  canvasH: number
}

type ArrowEndpointState = {
  pointerId: number
  endpoint: "tail" | "head"
  oppositeXPct: number
  oppositeYPct: number
  arrowHeightPct: number
  canvasW: number
  canvasH: number
}

type RotateState = {
  pointerId: number
  centerX: number
  centerY: number
  startAngle: number
  startRotation: number
}

export function AnnotationShapeElement({
  shape,
  canvasRef,
  onCenterGuideChange,
  previewMode,
}: {
  shape: AnnotationShape
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
  previewMode?: boolean
}) {
  const {
    selectedAnnotationShapeId,
    setSelectedAnnotationShapeId,
    setSelectedTextId,
    setSelectedAssetId,
    updateAnnotationShape,
    deleteAnnotationShape,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
  } = useEditor()
  const isSelected = selectedAnnotationShapeId === shape.id
  const dashArray = lineDashArray(shape.lineStyle)
  const elRef = React.useRef<HTMLDivElement>(null)
  const selectionChromeRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)
  const arrowEndpointRef = React.useRef<ArrowEndpointState | null>(null)
  const rotateRef = React.useRef<RotateState | null>(null)
  const [isRotateSnapped, setIsRotateSnapped] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [isAdjustingArrowEndpoint, setIsAdjustingArrowEndpoint] =
    React.useState(false)
  const [isRotating, setIsRotating] = React.useState(false)
  const [elementSize, setElementSize] = React.useState({
    width: 120,
    height: 48,
  })
  const rotation = shape.rotation ?? 0

  const {
    toolbarRect,
    hideFloatingToolbar,
    shouldAnimatePositionMove,
    measureRect,
    setToolbarRect,
  } = useFloatingToolbarRect({
    elRef,
    isSelected,
    bulkCanvasDragging,
    kind: "annotation",
    elementId: shape.id,
    trackPositionAnimate: true,
    onResize: (el) => {
      setElementSize((current) => {
        const width = Math.max(1, el.offsetWidth)
        const height = Math.max(1, el.offsetHeight)
        if (
          Math.abs(current.width - width) < 0.5 &&
          Math.abs(current.height - height) < 0.5
        ) {
          return current
        }
        return { width, height }
      })
    },
  })

  React.useEffect(() => {
    if (bulkCanvasDragging || !isSelected) return
    measureRect()
  }, [
    bulkCanvasDragging,
    isSelected,
    measureRect,
    shape.xPct,
    shape.yPct,
    shape.widthPct,
    shape.heightPct,
    rotation,
  ])

  React.useEffect(() => {
    if (!isSelected) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteAnnotationShape(shape.id)
        setSelectedAnnotationShapeId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    deleteAnnotationShape,
    isSelected,
    setSelectedAnnotationShapeId,
    shape.id,
  ])

  const selectShape = (
    e: React.PointerEvent | React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation()
    setSelectedAnnotationShapeId(shape.id)
    setSelectedTextId(null)
    setSelectedAssetId(null)
  }

  const startDrag = (e: React.PointerEvent<Element>) => {
    if (isStep) return
    const canvas = canvasRef.current
    if (!canvas || e.button !== 0) return
    selectShape(e)
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startXPct: shape.xPct,
      startYPct: shape.yPct,
      canvasW: rect.width,
      canvasH: rect.height,
      nextXPct: shape.xPct,
      nextYPct: shape.yPct,
      moved: false,
    }
    setIsDragging(true)
  }

  const moveDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    e.preventDefault()
    const dxPct = ((e.clientX - drag.startX) / drag.canvasW) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.canvasH) * 100
    let nextX = clamp(drag.startXPct + dxPct, -20, 120)
    let nextY = clamp(drag.startYPct + dyPct, -20, 120)
    const snapX = Math.abs(nextX - 50) <= (8 / drag.canvasW) * 100
    const snapY = Math.abs(nextY - 50) <= (8 / drag.canvasH) * 100
    if (snapX) nextX = 50
    if (snapY) nextY = 50
    onCenterGuideChange?.({ x: snapX, y: snapY })
    drag.nextXPct = nextX
    drag.nextYPct = nextY
    drag.moved = true
    const el = elRef.current
    if (el) {
      el.style.left = `${nextX}%`
      el.style.top = `${nextY}%`
      setToolbarRect(el.getBoundingClientRect())
    }
    const chrome = selectionChromeRef.current
    if (chrome) {
      chrome.style.left = `${nextX}%`
      chrome.style.top = `${nextY}%`
    }
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    setIsDragging(false)
    if (drag.moved) {
      updateAnnotationShape(shape.id, {
        xPct: drag.nextXPct,
        yPct: drag.nextYPct,
      })
    }
    onCenterGuideChange?.({ x: false, y: false })
  }

  const startResize =
    (handle: ResizeHandleId) => (e: React.PointerEvent<HTMLButtonElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = canvas.getBoundingClientRect()
      resizeRef.current = {
        pointerId: e.pointerId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startXPct: shape.xPct,
        startYPct: shape.yPct,
        startWidthPct: shape.widthPct,
        startHeightPct: shape.heightPct,
        canvasW: rect.width,
        canvasH: rect.height,
      }
      setIsResizing(true)
    }

  const startArrowEndpoint =
    (endpoint: "tail" | "head") =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = canvas.getBoundingClientRect()
      const endpoints = getArrowEndpoints(shape, rect.width, rect.height)
      const opposite = endpoint === "tail" ? endpoints.head : endpoints.tail
      arrowEndpointRef.current = {
        pointerId: e.pointerId,
        endpoint,
        oppositeXPct: opposite.xPct,
        oppositeYPct: opposite.yPct,
        arrowHeightPct: shape.heightPct,
        canvasW: rect.width,
        canvasH: rect.height,
      }
      setIsAdjustingArrowEndpoint(true)
    }

  const moveArrowEndpoint = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = arrowEndpointRef.current
    if (!state || state.pointerId !== e.pointerId) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const movingXPct = clamp(
      ((e.clientX - rect.left) / rect.width) * 100,
      -20,
      120
    )
    const movingYPct = clamp(
      ((e.clientY - rect.top) / rect.height) * 100,
      -20,
      120
    )
    const tail =
      state.endpoint === "tail"
        ? { xPct: movingXPct, yPct: movingYPct }
        : { xPct: state.oppositeXPct, yPct: state.oppositeYPct }
    const head =
      state.endpoint === "head"
        ? { xPct: movingXPct, yPct: movingYPct }
        : { xPct: state.oppositeXPct, yPct: state.oppositeYPct }
    const dxPx = ((head.xPct - tail.xPct) / 100) * state.canvasW
    const dyPx = ((head.yPct - tail.yPct) / 100) * state.canvasH
    const distancePx = Math.hypot(dxPx, dyPx)
    const minWidthPx = Math.max(56, shape.strokeWidth * 12)

    updateAnnotationShape(shape.id, {
      xPct: (tail.xPct + head.xPct) / 2,
      yPct: (tail.yPct + head.yPct) / 2,
      widthPct: (Math.max(minWidthPx, distancePx) / state.canvasW) * 100,
      heightPct: state.arrowHeightPct,
      rotation:
        distancePx > 0.5
          ? (Math.atan2(dyPx, dxPx) * 180) / Math.PI
          : shape.rotation,
    })
  }

  const endArrowEndpoint = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = arrowEndpointRef.current
    if (!state || state.pointerId !== e.pointerId) return
    arrowEndpointRef.current = null
    setIsAdjustingArrowEndpoint(false)
  }

  const moveResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    e.preventDefault()
    const dxPx = e.clientX - rs.startX
    const dyPx = e.clientY - rs.startY
    const theta = (rotation * Math.PI) / 180
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const localDxPx = cos * dxPx + sin * dyPx
    const localDyPx = -sin * dxPx + cos * dyPx
    const minWidthPx =
      shape.kind === "arrow" ? Math.max(56, shape.strokeWidth * 12) : 8
    const minHeightPx =
      shape.kind === "arrow" ? Math.max(56, shape.strokeWidth * 14) : 8
    const maxWidthPx = rs.canvasW * 2
    const maxHeightPx = rs.canvasH * 2
    const startWidthPx = (rs.startWidthPct / 100) * rs.canvasW
    const startHeightPx = (rs.startHeightPct / 100) * rs.canvasH
    let nextWidthPx = startWidthPx
    let nextHeightPx = startHeightPx
    let centerLocalXPx = 0
    let centerLocalYPx = 0

    if (rs.handle.includes("l")) {
      nextWidthPx = clamp(startWidthPx - localDxPx, minWidthPx, maxWidthPx)
      centerLocalXPx = -(nextWidthPx - startWidthPx) / 2
    }
    if (rs.handle.includes("r")) {
      nextWidthPx = clamp(startWidthPx + localDxPx, minWidthPx, maxWidthPx)
      centerLocalXPx = (nextWidthPx - startWidthPx) / 2
    }
    if (rs.handle.includes("t")) {
      nextHeightPx = clamp(startHeightPx - localDyPx, minHeightPx, maxHeightPx)
      centerLocalYPx = -(nextHeightPx - startHeightPx) / 2
    }
    if (rs.handle.includes("b")) {
      nextHeightPx = clamp(startHeightPx + localDyPx, minHeightPx, maxHeightPx)
      centerLocalYPx = (nextHeightPx - startHeightPx) / 2
    }

    const centerDxPx = cos * centerLocalXPx - sin * centerLocalYPx
    const centerDyPx = sin * centerLocalXPx + cos * centerLocalYPx
    const nextX = rs.startXPct + (centerDxPx / rs.canvasW) * 100
    const nextY = rs.startYPct + (centerDyPx / rs.canvasH) * 100
    const nextW = (nextWidthPx / rs.canvasW) * 100
    const nextH = (nextHeightPx / rs.canvasH) * 100

    updateAnnotationShape(shape.id, {
      xPct: clamp(nextX, -20, 120),
      yPct: clamp(nextY, -20, 120),
      widthPct: clamp(nextW, (minWidthPx / rs.canvasW) * 100, 200),
      heightPct: clamp(nextH, (minHeightPx / rs.canvasH) * 100, 200),
    })
  }

  const endResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    resizeRef.current = null
    setIsResizing(false)
  }

  const startRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = elRef.current
    if (!el) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    rotateRef.current = {
      pointerId: e.pointerId,
      centerX: cx,
      centerY: cy,
      startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
      startRotation: rotation,
    }
    setIsRotating(true)
  }

  const moveRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rot = rotateRef.current
    if (!rot || rot.pointerId !== e.pointerId) return
    const angle = Math.atan2(e.clientY - rot.centerY, e.clientX - rot.centerX)
    const delta = ((angle - rot.startAngle) * 180) / Math.PI
    let next = rot.startRotation + delta
    next = ((next % 360) + 360) % 360
    let snapped = false
    if (e.shiftKey) {
      next = Math.round(next / 15) * 15
      if (next % 90 === 0) snapped = true
    } else {
      const nearest90 = Math.round(next / 90) * 90
      if (
        Math.abs(next - nearest90) < 4 ||
        Math.abs(next - nearest90 + 360) < 4
      ) {
        next = nearest90 % 360
        snapped = true
      }
    }
    setIsRotateSnapped(snapped)
    updateAnnotationShape(shape.id, { rotation: next })
  }

  const endRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rot = rotateRef.current
    if (!rot || rot.pointerId !== e.pointerId) return
    rotateRef.current = null
    setIsRotating(false)
    setIsRotateSnapped(false)
  }

  const counterRotate = `rotate(${-rotation}deg)`
  const arrowGeometry =
    shape.kind === "arrow"
      ? getArrowGeometry(
          elementSize.width,
          elementSize.height,
          shape.strokeWidth
        )
      : null
  const isStep = shape.kind === "step"
  const STEP_SIZE = 28

  return (
    <>
      <div
        ref={elRef}
        role="button"
        tabIndex={0}
        aria-label={`${shape.kind} annotation`}
        className={cn(
          "nodrag nopan pointer-events-auto absolute touch-none select-none",
          isSelected ? "cursor-move" : "cursor-pointer"
        )}
        onClick={selectShape}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") selectShape(e)
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-annotation-shape-id={shape.id}
        style={{
          left: `${shape.xPct}%`,
          top: `${shape.yPct}%`,
          width: isStep ? STEP_SIZE : `${shape.widthPct}%`,
          height: isStep ? STEP_SIZE : `${shape.heightPct}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transition:
            !isDragging &&
            !isResizing &&
            !isAdjustingArrowEndpoint &&
            !isRotating &&
            shouldAnimatePositionMove
              ? "left 300ms ease-out, top 300ms ease-out"
              : "none",
          zIndex: 60 + shape.zIndex,
          opacity: (shape.opacity ?? 100) / 100,
          mixBlendMode:
            shape.blendMode && shape.blendMode !== "normal"
              ? shape.blendMode
              : undefined,
          display: shape.hidden ? "none" : undefined,
        }}
      >
        {shape.kind === "step" ? (
          <div
            className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
            style={{
              background: shape.color,
              fontSize: (shape.stepNumber ?? 1) >= 10 ? 11 : 13,
              lineHeight: 1,
              userSelect: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }}
          >
            {shape.stepNumber ?? 1}
          </div>
        ) : shape.kind === "arrow" ? (
          arrowGeometry ? (
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${arrowGeometry.width} ${arrowGeometry.height}`}
              preserveAspectRatio="none"
            >
              <line
                x1={arrowGeometry.tailX}
                y1={arrowGeometry.centerY}
                x2={arrowGeometry.tipX}
                y2={arrowGeometry.centerY}
                fill="none"
                stroke={shape.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={arrowGeometry.strokeWidth}
                strokeDasharray={scaledLineDashArray(
                  shape.lineStyle,
                  arrowGeometry.strokeWidth
                )}
              />
              <polyline
                points={arrowGeometry.headPoints}
                fill="none"
                stroke={shape.color}
                strokeWidth={arrowGeometry.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={scaledLineDashArray(
                  shape.lineStyle,
                  arrowGeometry.strokeWidth
                )}
              />
            </svg>
          ) : null
        ) : shape.kind === "blur" ? (
          <BlurRedactionShape shape={shape} />
        ) : (
          <svg
            className="h-full w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {shape.kind === "rect" ? (
              <rect
                x="4"
                y="4"
                width="92"
                height="92"
                rx="3"
                fill="none"
                stroke={shape.color}
                strokeWidth={shape.strokeWidth}
                strokeDasharray={dashArray}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <ellipse
                cx="50"
                cy="50"
                rx="46"
                ry="46"
                fill="none"
                stroke={shape.color}
                strokeWidth={shape.strokeWidth}
                strokeDasharray={dashArray}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>
      {isSelected && !previewMode && !isStep ? (
        <div
          ref={selectionChromeRef}
          data-annotation-selection-chrome-id={shape.id}
          data-export-hidden="true"
          className="pointer-events-none absolute touch-none select-none"
          style={{
            left: `${shape.xPct}%`,
            top: `${shape.yPct}%`,
            width: isStep ? STEP_SIZE : `${shape.widthPct}%`,
            height: isStep ? STEP_SIZE : `${shape.heightPct}%`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            zIndex: 1001 + shape.zIndex,
            display: shape.hidden ? "none" : undefined,
          }}
        >
          {shape.kind !== "arrow" ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 border border-dashed border-[#92b97a]/80",
                isStep && "rounded-full"
              )}
            />
          ) : null}
          {isRotateSnapped && (
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-[-1] -translate-x-1/2 -translate-y-1/2">
              <div className="absolute w-[4000px] -translate-x-1/2 border-t border-dashed border-[#9BCD64]/95" />
              <div className="absolute h-[4000px] -translate-y-1/2 border-l border-dashed border-[#9BCD64]/95" />
            </div>
          )}
          {isStep
            ? null
            : shape.kind === "arrow"
              ? ARROW_ENDPOINT_HANDLES.map((handle) => (
                  <button
                    key={handle.id}
                    aria-label={`${handle.id} arrow endpoint`}
                    className={cn(
                      "pointer-events-auto absolute z-10 size-5 rounded-full border-2 border-[#92b97a] bg-background shadow",
                      handle.className
                    )}
                    onPointerDown={startArrowEndpoint(handle.id)}
                    onPointerMove={moveArrowEndpoint}
                    onPointerUp={endArrowEndpoint}
                    onPointerCancel={endArrowEndpoint}
                  />
                ))
              : RESIZE_HANDLES.map((handle) => (
                  <button
                    key={handle}
                    aria-label={`Resize ${handle}`}
                    className={cn(
                      "pointer-events-auto absolute z-10 size-2.5 rounded-full border border-[#92b97a] bg-background shadow",
                      HANDLE_CLASS[handle]
                    )}
                    onPointerDown={startResize(handle)}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                  />
                ))}
          {!isStep ? (
            <button
              aria-label="Rotate shape"
              onPointerDown={startRotate}
              onPointerMove={moveRotate}
              onPointerUp={endRotate}
              onPointerCancel={endRotate}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute -bottom-9 left-1/2 z-10 flex size-7 cursor-grab items-center justify-center rounded-full border border-[#92b97a]/80 bg-background/95 text-[#92b97a] shadow-md backdrop-blur-md"
              style={{
                transform: `translate(-50%, 0) ${counterRotate}`,
                transformOrigin: "top center",
              }}
            >
              <RiRefreshLine className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {!previewMode &&
      !bulkCanvasDragging &&
      !isStep &&
      isSelected &&
      !hideFloatingToolbar &&
      toolbarRect &&
      typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              const scale = bulkEditMode
                ? bulkToolbarScale(bulkViewportZoom)
                : 1
              return (
                <div
                  data-editor-floating-toolbar-target={`annotation-shape:${shape.id}`}
                  className="pointer-events-none fixed z-40"
                  style={{
                    top,
                    left,
                    transform: floatingToolbarTransform(flipBelow, scale),
                    transformOrigin: flipBelow ? "top center" : "bottom center",
                  }}
                >
                  <div className="pointer-events-auto">
                    <AnnotationShapeToolbar
                      shape={shape}
                      onDragPointerDown={startDrag}
                      onDragPointerMove={moveDrag}
                      onDragPointerUp={endDrag}
                    />
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
