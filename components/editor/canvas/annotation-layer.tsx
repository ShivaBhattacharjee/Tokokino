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
  return (
    <svg
      ref={layerRef}
      aria-label="Annotation layer"
      className={cn(
        "absolute inset-0 z-[80] h-full w-full touch-none",
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
    >
      <defs>
        <mask
          id={annotationMaskId}
          x="0"
          y="0"
          width="100%"
          height="100%"
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {annotations
            .filter((stroke) => stroke.mode === "eraser")
            .map((stroke) => (
              <path
                key={stroke.id}
                data-annotation-stroke-id={stroke.id}
                d={annotationPath(stroke.points)}
                fill="none"
                stroke="black"
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
        </mask>
      </defs>
      <g mask={`url(#${annotationMaskId})`}>
        {annotations
          .filter((stroke) => stroke.mode !== "eraser")
          .map((stroke) => (
            <path
              key={stroke.id}
              data-annotation-stroke-id={stroke.id}
              d={annotationPath(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={stroke.mode === "highlight" ? 0.42 : 1}
              style={{
                mixBlendMode:
                  stroke.mode === "highlight" ? "multiply" : "normal",
              }}
            />
          ))}
      </g>
    </svg>
  )
}
