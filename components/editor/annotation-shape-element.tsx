"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  RiBringToFront,
  RiDeleteBinLine,
  RiDragMove2Line,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
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
  const rotateRef = React.useRef<RotateState | null>(null)
  const [isRotateSnapped, setIsRotateSnapped] = React.useState(false)
  const [toolbarRect, setToolbarRect] = React.useState<DOMRect | null>(null)
  const rotation = shape.rotation ?? 0

  React.useEffect(() => {
    if (!isSelected || !elRef.current) {
      setToolbarRect(null)
      return
    }
    const el = elRef.current
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

  const moveResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeRef.current
    if (!rs || rs.pointerId !== e.pointerId) return
    e.preventDefault()
    const dxPct = ((e.clientX - rs.startX) / rs.canvasW) * 100
    const dyPct = ((e.clientY - rs.startY) / rs.canvasH) * 100
    const minSize = 1
    let nextX = rs.startXPct
    let nextY = rs.startYPct
    let nextW = rs.startWidthPct
    let nextH = rs.startHeightPct

    const left = rs.startXPct - rs.startWidthPct / 2
    const right = rs.startXPct + rs.startWidthPct / 2
    const top = rs.startYPct - rs.startHeightPct / 2
    const bottom = rs.startYPct + rs.startHeightPct / 2

    if (rs.handle.includes("l")) {
      nextW = Math.max(minSize, rs.startWidthPct - dxPct)
      nextX = right - nextW / 2
    }
    if (rs.handle.includes("r")) {
      nextW = Math.max(minSize, rs.startWidthPct + dxPct)
      nextX = left + nextW / 2
    }
    if (rs.handle.includes("t")) {
      nextH = Math.max(minSize, rs.startHeightPct - dyPct)
      nextY = bottom - nextH / 2
    }
    if (rs.handle.includes("b")) {
      nextH = Math.max(minSize, rs.startHeightPct + dyPct)
      nextY = top + nextH / 2
    }

    updateAnnotationShape(shape.id, {
      xPct: clamp(nextX, -20, 120),
      yPct: clamp(nextY, -20, 120),
      widthPct: clamp(nextW, minSize, 200),
      heightPct: clamp(nextH, minSize, 200),
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
      if (Math.abs(next - nearest90) < 4 || Math.abs(next - nearest90 + 360) < 4) {
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
          <>
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                fill="none"
                stroke={shape.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={shape.strokeWidth}
                strokeDasharray={dashArray}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute"
              viewBox="0 0 10 10"
              preserveAspectRatio="xMidYMid meet"
              style={{
                right: 0,
                top: "50%",
                width: `${Math.max(16, shape.strokeWidth * 7)}px`,
                height: `${Math.max(16, shape.strokeWidth * 7)}px`,
                transform: "translateY(-50%)",
                overflow: "visible",
              }}
            >
              <polyline
                points="1.5,1.5 9.5,5 1.5,8.5"
                fill="none"
                stroke={shape.color}
                strokeWidth={shape.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </>
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
            <div className="pointer-events-none absolute inset-0 border border-dashed border-[#92b97a]/80" />
            {isRotateSnapped && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-[-1] -translate-x-1/2 -translate-y-1/2">
                <div className="absolute w-[4000px] -translate-x-1/2 border-t border-dashed border-[#9BCD64]/95" />
                <div className="absolute h-[4000px] -translate-y-1/2 border-l border-dashed border-[#9BCD64]/95" />
              </div>
            )}
            {RESIZE_HANDLES.map((handle) => (
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
              className="absolute -bottom-9 left-1/2 z-10 flex size-7 items-center justify-center rounded-full border border-[#92b97a]/80 bg-background/95 text-[#92b97a] shadow-md backdrop-blur-md cursor-grab"
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
        <button
          aria-label="Shape color"
          className={cn(iconBtnClass, "mx-1")}
        >
          <span
            className="block size-5 rounded-full border border-foreground/10"
            style={{ background: shape.color }}
          />
        </button>
      </ColorPickerPopover>

      <span className="mx-1 h-5 w-px bg-border" />

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
          className="w-44 border-border/60 bg-popover/95 p-1 backdrop-blur-md"
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
          <line x1="4" y1="15" x2="14" y2="5" strokeDasharray={dashArray} />
          <polyline points="10,5 14,5 14,9" strokeDasharray={dashArray} />
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function lineDashArray(style: AnnotationShape["lineStyle"]) {
  if (style === "dashed") return "5 3"
  if (style === "dotted") return "2.2 2.2"
  return undefined
}
