"use client"

import * as React from "react"
import { RiRefreshLine } from "@remixicon/react"

import type { TextElement } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { RESIZE_HANDLES } from "./constants"
import { TextResizeLens } from "./resize-lens"
import type { ResizeHandleId, ResizeLensState } from "./types"

export function TextSelectionControls({
  text,
  counterRotate,
  isRotateSnapped,
  resizeLens,
  borderStyle,
  borderWidth,
  borderColor,
  startRotate,
  moveRotate,
  endRotate,
  startResize,
  moveResize,
  endResize,
}: {
  text: TextElement
  counterRotate: string
  isRotateSnapped: boolean
  resizeLens: ResizeLensState | null
  borderStyle: string
  borderWidth: number
  borderColor: string
  startRotate: (e: React.PointerEvent<HTMLButtonElement>) => void
  moveRotate: (e: React.PointerEvent<HTMLButtonElement>) => void
  endRotate: (e: React.PointerEvent<HTMLButtonElement>) => void
  startResize: (
    handle: ResizeHandleId
  ) => (e: React.PointerEvent<HTMLButtonElement>) => void
  moveResize: (e: React.PointerEvent<HTMLButtonElement>) => void
  endResize: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <div data-export-hidden="true" className="contents">
      {isRotateSnapped ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-[-1] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <div className="absolute w-[4000px] border-t border-dashed border-[#9BCD64]/95" />
          <div className="absolute h-[4000px] border-l border-dashed border-[#9BCD64]/95" />
        </div>
      ) : null}

      <button
        aria-label="Rotate text"
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

      {resizeLens ? (
        <TextResizeLens
          resizeLens={resizeLens}
          text={text}
          borderStyle={borderStyle}
          borderWidth={borderWidth}
          borderColor={borderColor}
        />
      ) : null}

      {RESIZE_HANDLES.map(([id, vClass, hClass, transformClass, cursor]) => (
        <button
          key={id}
          aria-label={`Resize ${id}`}
          onPointerDown={startResize(id)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex",
            "absolute z-10 size-8 touch-none items-center justify-center rounded-full border border-transparent bg-transparent",
            "md:block md:size-2.5 md:border-[#92b97a] md:bg-background md:shadow",
            vClass,
            hClass,
            transformClass
          )}
          style={{ cursor }}
        >
          <span
            className={cn(
              "block rounded-full border border-[#92b97a] bg-background shadow md:hidden",
              id === "ml" || id === "mr" ? "h-6 w-2" : "size-3"
            )}
          />
        </button>
      ))}
    </div>
  )
}
