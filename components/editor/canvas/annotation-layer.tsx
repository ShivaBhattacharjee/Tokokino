"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { AnnotationStroke } from "@/lib/editor/store"

import { annotationPath } from "./helpers"

type AnnotationLayerProps = {
  layerRef: React.RefObject<SVGSVGElement | null>
  annotations: AnnotationStroke[]
  annotationMaskId: string
  isAnnotating: boolean
  cursorClass: string
  /** When set, shows a circular eraser brush preview matching stroke width. */
  eraserBrushSize?: number | null
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void
  onClick: (e: React.MouseEvent<SVGSVGElement>) => void
  onDoubleClick: (e: React.MouseEvent<SVGSVGElement>) => void
}

export function AnnotationLayer({
  layerRef,
  annotations,
  annotationMaskId,
  isAnnotating,
  cursorClass,
  eraserBrushSize = null,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onDoubleClick,
}: AnnotationLayerProps) {
  const [eraserBrushPos, setEraserBrushPos] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const showEraserBrush =
    isAnnotating && eraserBrushSize != null && eraserBrushSize > 0

  const eraserStrokes = React.useMemo(() => {
    const strokes: AnnotationStroke[] = []
    for (const stroke of annotations) {
      if (stroke.mode === "eraser") strokes.push(stroke)
    }
    return strokes
  }, [annotations])
  const visibleStrokes = React.useMemo(() => {
    const strokes: AnnotationStroke[] = []
    for (const stroke of annotations) {
      if (stroke.mode !== "eraser" && !stroke.hidden) strokes.push(stroke)
    }
    return strokes
  }, [annotations])

  const updateEraserBrushPos = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!showEraserBrush) {
        setEraserBrushPos(null)
        return
      }
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setEraserBrushPos({
        x: ((e.clientX - rect.left) / rect.width) * svg.clientWidth,
        y: ((e.clientY - rect.top) / rect.height) * svg.clientHeight,
      })
    },
    [showEraserBrush]
  )

  return (
    <>
      {visibleStrokes.map((stroke) => (
        <svg
          key={stroke.id}
          aria-hidden
          data-export-stack="foreground"
          className="pointer-events-none absolute inset-0 h-full w-full touch-none"
          style={{
            zIndex: 60 + (stroke.zIndex ?? 0),
            mixBlendMode:
              stroke.blendMode ??
              (stroke.mode === "highlight" ? "multiply" : "normal"),
          }}
        >
          <defs>
            <mask
              id={`${annotationMaskId}-${stroke.id}`}
              x="0"
              y="0"
              width="100%"
              height="100%"
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {eraserStrokes.map((eraser) => (
                <path
                  key={eraser.id}
                  data-annotation-eraser-id={eraser.id}
                  d={annotationPath(eraser.points)}
                  fill="none"
                  stroke="black"
                  strokeWidth={eraser.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </mask>
          </defs>
          <g mask={`url(#${annotationMaskId}-${stroke.id})`}>
            <path
              key={stroke.id}
              data-annotation-stroke-id={stroke.id}
              d={annotationPath(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={
                ((stroke.opacity ?? 100) / 100) *
                (stroke.mode === "highlight" ? 0.42 : 1)
              }
            />
          </g>
        </svg>
      ))}

      <svg
        ref={layerRef}
        aria-label="Annotation layer"
        className={cn(
          "absolute inset-0 z-[1000] h-full w-full touch-none",
          isAnnotating
            ? `pointer-events-auto ${cursorClass}`
            : "pointer-events-none"
        )}
        onPointerDown={(e) => {
          updateEraserBrushPos(e)
          onPointerDown(e)
        }}
        onPointerMove={(e) => {
          updateEraserBrushPos(e)
          onPointerMove(e)
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setEraserBrushPos(null)}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />

      {showEraserBrush && eraserBrushPos ? (
        <div
          aria-hidden
          data-export-hidden="true"
          data-annotation-eraser-brush="true"
          className="pointer-events-none absolute z-[1001] rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.75)]"
          style={{
            left: eraserBrushPos.x,
            top: eraserBrushPos.y,
            width: eraserBrushSize,
            height: eraserBrushSize,
            transform: "translate(-50%, -50%)",
          }}
        />
      ) : null}
    </>
  )
}
