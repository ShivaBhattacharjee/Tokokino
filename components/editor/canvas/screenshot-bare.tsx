"use client"

import * as React from "react"
import {
  RiCropLine,
  RiDeleteBinLine,
  RiRefreshLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"

type PlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

type ScreenshotBareProps = {
  screenshot: string
  imgStyle: React.CSSProperties
  positionedStyle: React.CSSProperties | null
  transform: string
  screenshotLeft: number | undefined
  screenshotTop: number | undefined
  placementDims: PlacementDims | null
  screenshotLayer: ScreenshotLayer
  isScreenshotSelected: boolean
  isScreenshotDragging: boolean
  suppressTransition: boolean
  activeTool: EditorTool
  selectedTextId: string | null
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onContainerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onSelect: (e: React.MouseEvent<HTMLImageElement>) => void
  onPointerDown: (e: React.PointerEvent<HTMLImageElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLImageElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLImageElement>) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
}

export function ScreenshotBare({
  screenshot,
  imgStyle,
  positionedStyle,
  transform,
  screenshotLeft,
  screenshotTop,
  placementDims,
  screenshotLayer,
  isScreenshotSelected,
  isScreenshotDragging,
  suppressTransition,
  activeTool,
  selectedTextId,
  stageRef,
  imageRef,
  onContainerPointerDown,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
}: ScreenshotBareProps) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null)

  return (
    <div
      ref={stageRef}
      className="group/screenshot pointer-events-none relative h-full w-full"
      onPointerDown={onContainerPointerDown}
    >
      <img
        ref={imageRef}
        src={screenshot}
        alt="Screenshot"
        draggable={false}
        onLoad={onImageLoad}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          ...imgStyle,
          left: screenshotLeft ?? "50%",
          top: screenshotTop ?? "50%",
          ...(positionedStyle
            ? null
            : {
                transform: `translate(-50%, -50%) ${transform}`,
              }),
        }}
        className={cn(
          "pointer-events-auto absolute max-h-full max-w-full object-contain select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging || suppressTransition
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab",
          isScreenshotSelected &&
            activeTool === "pointer" &&
            "ring-2 ring-blue-400/90"
        )}
      />

      {activeTool === "pointer" && placementDims && !selectedTextId && (
        <div
          className={cn(
            "pointer-events-none absolute z-50 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover/screenshot:opacity-100",
            isScreenshotDragging || suppressTransition
              ? "transition-none"
              : "transition-[opacity,left,top] duration-300 ease-out"
          )}
          style={{
            left:
              (screenshotLeft ??
                placementDims.stageW / 2 - placementDims.imgW / 2) +
              placementDims.imgW / 2,
            top:
              (screenshotTop ??
                placementDims.stageH / 2 - placementDims.imgH / 2) +
              placementDims.imgH / 2,
            transform: "translate(-50%, -50%)",
          }}
        >
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onReplaceFile(file)
              e.target.value = ""
            }}
          />
          <button
            onClick={onCropClick}
            className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-black/90"
            title="Crop image"
          >
            <RiCropLine className="size-5" />
          </button>
          <button
            onClick={() => replaceInputRef.current?.click()}
            className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-black/90"
            title="Replace image"
          >
            <RiRefreshLine className="size-5" />
          </button>
          <button
            onClick={onDelete}
            className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-transform hover:scale-110 hover:bg-red-500/90"
            title="Delete image"
          >
            <RiDeleteBinLine className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
