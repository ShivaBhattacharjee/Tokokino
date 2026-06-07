"use client"

import * as React from "react"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import { ScreenshotEditMenu } from "./screenshot-edit-menu"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import type { CaptureDevice, CaptureSettings } from "./upload-card"

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
  onCaptureWebsite?: (
    url: string,
    settings: CaptureSettings
  ) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
  shadowBoxTarget?: boolean
  objectFit?: "contain" | "cover" | "fill"
  innerLightingStyle?: React.CSSProperties | null
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
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureStateKey,
  shadowBoxTarget = false,
  objectFit = "cover",
  innerLightingStyle,
}: ScreenshotBareProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const screenshotLeftValue =
    typeof screenshotLeft === "number" ? `${screenshotLeft}px` : "50%"
  const screenshotTopValue =
    typeof screenshotTop === "number" ? `${screenshotTop}px` : "50%"

  return (
    <div
      ref={stageRef}
      className="group/screenshot pointer-events-none relative h-full w-full overflow-visible"
      onPointerDown={onContainerPointerDown}
    >
      <ShimmerImage
        ref={imageRef}
        shimmer={false}
        data-box-hover-target
        data-editor-shadow-box-target={shadowBoxTarget ? "" : undefined}
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
          left: `var(--editor-main-bare-left, ${screenshotLeftValue})`,
          top: `var(--editor-main-bare-top, ${screenshotTopValue})`,
          ...(positionedStyle
            ? null
            : {
                transform: `translate(-50%, -50%) ${transform}`,
              }),
        }}
        className={cn(
          "pointer-events-auto absolute select-none",
          objectFit === "cover" && "h-full w-full object-cover",
          objectFit === "fill" && "h-full w-full object-fill",
          objectFit === "contain" && "max-h-full max-w-full object-contain",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging ||
            suppressTransition ||
            activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab",
          isScreenshotSelected && activeTool === "pointer" && "outline-none"
        )}
      />

      {innerLightingStyle && !screenshotLayer.hidden ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute",
            objectFit === "cover" && "h-full w-full",
            objectFit === "fill" && "h-full w-full",
            objectFit === "contain" && "max-h-full max-w-full"
          )}
          style={{
            ...innerLightingStyle,
            borderRadius: imgStyle.borderRadius,
            left: `var(--editor-main-bare-left, ${screenshotLeftValue})`,
            top: `var(--editor-main-bare-top, ${screenshotTopValue})`,
            zIndex: 1,
            ...(positionedStyle
              ? {
                  transform: imgStyle.transform,
                  transformStyle: imgStyle.transformStyle,
                }
              : {
                  transform: `translate(-50%, -50%) ${transform}`,
                  transformStyle: "preserve-3d",
                }),
          }}
        />
      ) : null}

      {activeTool === "pointer" && placementDims && !selectedTextId && (
        <div
          className={cn(
            "pointer-events-none absolute z-50 flex items-center justify-center transition-opacity",
            editOpen || isScreenshotSelected
              ? "opacity-100"
              : "opacity-0 group-hover/screenshot:opacity-100",
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
            transform: `translate(-50%, -50%) ${transform}`,
            transformOrigin: "center",
            transformStyle: "preserve-3d",
          }}
        >
          <ScreenshotEditMenu
            open={editOpen}
            onOpenChange={setEditOpen}
            onCrop={onCropClick}
            onReplaceFile={onReplaceFile}
            onDelete={onDelete}
            onCaptureWebsite={onCaptureWebsite}
            onLoadTweet={onLoadTweet}
            captureDefaultDevice={captureDefaultDevice}
            captureStateKey={captureStateKey}
          />
        </div>
      )}
    </div>
  )
}
