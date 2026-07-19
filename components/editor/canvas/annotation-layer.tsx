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
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onDoubleClick,
}: AnnotationLayerProps) {
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    </>
  )
}
