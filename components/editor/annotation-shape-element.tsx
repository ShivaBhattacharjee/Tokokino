"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  RiBringToFront,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiEqualizerLine,
  RiFileCopyLine,
  RiMoreFill,
  RiRefreshLine,
  RiSendToBack,
} from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ANNOTATION_STROKES,
  type AnnotationLineStyle,
  type AnnotationShape,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

type ResizeHandleId = "tl" | "tr" | "bl" | "br" | "ml" | "mr" | "mt" | "mb"

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startXPct: number
  startYPct: number
  canvasW: number
  canvasH: number
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

const iconBtnClass =
  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer shrink-0"

export function AnnotationShapeElement({
  shape,
  canvasRef,
  onCenterGuideChange,
}: {
  shape: AnnotationShape
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCenterGuideChange?: (guides: { x: boolean; y: boolean }) => void
}) {
  const {
    selectedAnnotationShapeId,
    setSelectedAnnotationShapeId,
    setSelectedTextId,
    setSelectedAssetId,
    updateAnnotationShape,
    deleteAnnotationShape,
  } = useEditor()
  const isSelected = selectedAnnotationShapeId === shape.id
  const dashArray = lineDashArray(shape.lineStyle)
  const elRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const resizeRef = React.useRef<ResizeState | null>(null)
  const arrowEndpointRef = React.useRef<ArrowEndpointState | null>(null)
  const rotateRef = React.useRef<RotateState | null>(null)
  const [isRotateSnapped, setIsRotateSnapped] = React.useState(false)
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)
  const [elementSize, setElementSize] = React.useState({
    width: 120,
    height: 48,
  })
  const rotation = shape.rotation ?? 0

  React.useEffect(() => {
    if (!elRef.current) {
      return
    }
    const el = elRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (isSelected) setToolbarRect(rect)
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
    }
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
  }, [isSelected])

  React.useEffect(() => {
    if (!isSelected || !elRef.current) return
    setToolbarRect(elRef.current.getBoundingClientRect())
  }, [
    isSelected,
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
    }
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
    updateAnnotationShape(shape.id, { xPct: nextX, yPct: nextY })
  }

  const endDrag = (e: React.PointerEvent<Element>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
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

  return (
    <>
      <div
        ref={elRef}
        role="button"
        tabIndex={0}
        aria-label={`${shape.kind} annotation`}
        className={cn(
          "pointer-events-auto absolute touch-none select-none",
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
        style={{
          left: `${shape.xPct}%`,
          top: `${shape.yPct}%`,
          width: `${shape.widthPct}%`,
          height: `${shape.heightPct}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          zIndex: 86 + shape.zIndex,
        }}
      >
        {shape.kind === "arrow" ? (
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
              />
            </svg>
          ) : null
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

        {isSelected ? (
          <>
            {shape.kind !== "arrow" ? (
              <div className="pointer-events-none absolute inset-0 border border-dashed border-[#92b97a]/80" />
            ) : null}
            {isRotateSnapped && (
              <div className="pointer-events-none absolute top-1/2 left-1/2 z-[-1] -translate-x-1/2 -translate-y-1/2">
                <div className="absolute w-[4000px] -translate-x-1/2 border-t border-dashed border-[#9BCD64]/95" />
                <div className="absolute h-[4000px] -translate-y-1/2 border-l border-dashed border-[#9BCD64]/95" />
              </div>
            )}
            {shape.kind === "arrow"
              ? ARROW_ENDPOINT_HANDLES.map((handle) => (
                  <button
                    key={handle.id}
                    aria-label={`${handle.id} arrow endpoint`}
                    className={cn(
                      "absolute z-10 size-5 rounded-full border-2 border-[#92b97a] bg-background shadow",
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
                      "absolute z-10 size-2.5 rounded-full border border-[#92b97a] bg-background shadow",
                      HANDLE_CLASS[handle]
                    )}
                    onPointerDown={startResize(handle)}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                  />
                ))}
            <button
              aria-label="Rotate shape"
              onPointerDown={startRotate}
              onPointerMove={moveRotate}
              onPointerUp={endRotate}
              onPointerCancel={endRotate}
              onClick={(e) => e.stopPropagation()}
              className="absolute -bottom-9 left-1/2 z-10 flex size-7 cursor-grab items-center justify-center rounded-full border border-[#92b97a]/80 bg-background/95 text-[#92b97a] shadow-md backdrop-blur-md"
              style={{
                transform: `translate(-50%, 0) ${counterRotate}`,
                transformOrigin: "top center",
              }}
            >
              <RiRefreshLine className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>
      {isSelected && toolbarRect && typeof document !== "undefined"
        ? createPortal(
            (() => {
              const flipBelow = toolbarRect.top < 80
              const top = flipBelow
                ? toolbarRect.bottom + 12
                : toolbarRect.top - 12
              const left = toolbarRect.left + toolbarRect.width / 2
              return (
                <div
                  className="pointer-events-none fixed z-[100]"
                  style={{
                    top,
                    left,
                    transform: flipBelow
                      ? "translate(-50%, 0)"
                      : "translate(-50%, -100%)",
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

function AnnotationShapeToolbar({
  shape,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
}: {
  shape: AnnotationShape
  onDragPointerDown: (e: React.PointerEvent<Element>) => void
  onDragPointerMove: (e: React.PointerEvent<Element>) => void
  onDragPointerUp: (e: React.PointerEvent<Element>) => void
}) {
  const {
    updateAnnotationShape,
    deleteAnnotationShape,
    duplicateAnnotationShape,
    bringAnnotationShapeToFront,
    sendAnnotationShapeToBack,
    setSelectedAnnotationShapeId,
  } = useEditor()
  const [moreOpen, setMoreOpen] = React.useState(false)

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Move shape"
            className={cn(iconBtnClass, "cursor-move active:cursor-grabbing")}
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
          >
            <RiDragMove2Line className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Drag shape</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Delete shape"
            className={cn(iconBtnClass, "text-red-500 hover:text-red-500")}
            onClick={() => {
              deleteAnnotationShape(shape.id)
              setSelectedAnnotationShapeId(null)
            }}
          >
            <RiDeleteBinLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Delete</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Duplicate shape"
            className={iconBtnClass}
            onClick={() => {
              const id = duplicateAnnotationShape(shape.id)
              if (id) setSelectedAnnotationShapeId(id)
            }}
          >
            <RiFileCopyLine className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Duplicate</TooltipContent>
      </Tooltip>

      <ColorPickerPopover
        value={shape.color}
        side="top"
        align="center"
        onChange={(color) => updateAnnotationShape(shape.id, { color })}
      >
        <button aria-label="Shape color" className={cn(iconBtnClass, "mx-1")}>
          <span
            className="block size-5 rounded-full border border-foreground/10"
            style={{ background: shape.color }}
          />
        </button>
      </ColorPickerPopover>

      {LINE_STYLES.map((style) => (
        <Tooltip key={style.id}>
          <TooltipTrigger asChild>
            <button
              aria-label={`${style.label} line`}
              className={cn(
                iconBtnClass,
                shape.lineStyle === style.id && "bg-accent text-foreground"
              )}
              onClick={() =>
                updateAnnotationShape(shape.id, { lineStyle: style.id })
              }
            >
              <LineStylePreview
                style={style.id}
                kind={shape.kind}
                active={shape.lineStyle === style.id}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{style.label}</TooltipContent>
        </Tooltip>
      ))}

      <span className="mx-1 h-5 w-px bg-border" />

      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button aria-label="More options" className={iconBtnClass}>
                <RiMoreFill className="size-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">More options</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className="w-56 border-border/60 bg-popover/95 p-1 backdrop-blur-md"
        >
          <div className="flex flex-col">
            <button
              onClick={() => {
                bringAnnotationShapeToFront(shape.id)
                setMoreOpen(false)
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <RiBringToFront className="size-4" />
              Bring to front
            </button>
            <button
              onClick={() => {
                sendAnnotationShapeToBack(shape.id)
                setMoreOpen(false)
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <RiSendToBack className="size-4" />
              Send to back
            </button>
            <div className="my-1 h-px bg-border/70" />
            <ThicknessMenuSection
              value={shape.strokeWidth}
              color={shape.color}
              onChange={(strokeWidth) =>
                updateAnnotationShape(shape.id, { strokeWidth })
              }
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const LINE_STYLES: { id: AnnotationLineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Short Dash" },
]

function ThicknessMenuSection({
  value,
  color,
  onChange,
}: {
  value: number
  color: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 px-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          <RiEqualizerLine className="size-4 text-muted-foreground" />
          Thickness
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {value}px
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {ANNOTATION_STROKES.map((strokeWidth) => {
          const isActive = value === strokeWidth
          return (
            <button
              key={strokeWidth}
              aria-label={`${strokeWidth}px thickness`}
              onClick={() => onChange(strokeWidth)}
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-md border border-transparent transition-colors hover:bg-accent",
                isActive && "border-border bg-accent"
              )}
            >
              <span
                className="block rounded-full"
                style={{
                  width: Math.min(24, strokeWidth * 2 + 6),
                  height: Math.min(24, strokeWidth * 2 + 6),
                  background: color,
                }}
              />
            </button>
          )
        })}
      </div>
      <Slider
        value={[value]}
        min={1}
        max={24}
        step={1}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  )
}

function LineStylePreview({
  style,
  kind,
  active,
}: {
  style: AnnotationLineStyle
  kind: AnnotationShape["kind"]
  active: boolean
}) {
  const strokeColor = active ? "text-foreground" : "text-foreground/55"
  const dashArray = lineDashArray(style)
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 overflow-visible", strokeColor)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "arrow" ? (
        <>
          <path d="M6 14L14 6" strokeDasharray={dashArray} />
          <path d="M8 6H14V12" />
        </>
      ) : kind === "rect" ? (
        <rect
          x="3.5"
          y="3.5"
          width="13"
          height="13"
          rx="2.5"
          strokeDasharray={dashArray}
        />
      ) : (
        <circle cx="10" cy="10" r="6.5" strokeDasharray={dashArray} />
      )}
    </svg>
  )
}

const RESIZE_HANDLES: ResizeHandleId[] = [
  "tl",
  "mt",
  "tr",
  "ml",
  "mr",
  "bl",
  "mb",
  "br",
]

const ARROW_ENDPOINT_HANDLES: {
  id: "tail" | "head"
  className: string
}[] = [
  {
    id: "tail",
    className:
      "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
  },
  {
    id: "head",
    className:
      "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
  },
]

const HANDLE_CLASS: Record<ResizeHandleId, string> = {
  tl: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  mt: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  tr: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  ml: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  mr: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  mb: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
}

function getArrowGeometry(width: number, height: number, strokeWidth: number) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const visualStrokeWidth = clamp(strokeWidth * 2.8, 8, Math.max(8, safeHeight * 0.58))
  const pad = Math.max(visualStrokeWidth / 2, 1)
  const centerY = safeHeight / 2
  const tipX = Math.max(pad, safeWidth - pad)
  const tailX = Math.min(pad, tipX - 1)
  const availableLength = Math.max(1, tipX - tailX)
  const targetHead = clamp(visualStrokeWidth * 3.2, 28, 72)
  const headLength = Math.min(targetHead, availableLength * 0.42)
  const headSpread = Math.min(targetHead * 0.72, Math.max(4, safeHeight / 2 - pad))
  const headBaseX = Math.max(tailX, tipX - headLength)
  const topY = clamp(centerY - headSpread, pad, safeHeight - pad)
  const bottomY = clamp(centerY + headSpread, pad, safeHeight - pad)

  return {
    width: safeWidth,
    height: safeHeight,
    tailX,
    tipX,
    centerY,
    strokeWidth: visualStrokeWidth,
    headPoints: `${headBaseX},${topY} ${tipX},${centerY} ${headBaseX},${bottomY}`,
  }
}

function getArrowEndpoints(
  shape: AnnotationShape,
  canvasW: number,
  canvasH: number
) {
  const centerX = (shape.xPct / 100) * canvasW
  const centerY = (shape.yPct / 100) * canvasH
  const length = (shape.widthPct / 100) * canvasW
  const theta = ((shape.rotation ?? 0) * Math.PI) / 180
  const dx = (Math.cos(theta) * length) / 2
  const dy = (Math.sin(theta) * length) / 2

  return {
    tail: {
      xPct: ((centerX - dx) / canvasW) * 100,
      yPct: ((centerY - dy) / canvasH) * 100,
    },
    head: {
      xPct: ((centerX + dx) / canvasW) * 100,
      yPct: ((centerY + dy) / canvasH) * 100,
    },
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function lineDashArray(style: AnnotationShape["lineStyle"]) {
  if (style === "dashed") return "5 3"
  if (style === "dotted") return "2.2 2.2"
  return undefined
}

function scaledLineDashArray(
  style: AnnotationShape["lineStyle"],
  strokeWidth: number
) {
  if (style === "dashed") return `${strokeWidth * 2.2} ${strokeWidth * 1.35}`
  if (style === "dotted") return `0.1 ${strokeWidth * 1.75}`
  return undefined
}
