"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type {
  EditorTool,
  ScreenshotLayer,
} from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import { mockupScreenClipStyle, mockupScreenTransform } from "./helpers"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type PlacementDims = {
  stageW: number
  stageH: number
  imgW: number
  imgH: number
}

type ScreenshotMockupProps = {
  screenshot: string
  mockupAsset: DeviceMockupAsset
  mockupSpec: DeviceMockupSpec
  screenshotLayer: ScreenshotLayer
  transform: string
  shadowFilter: string | undefined
  screenshotOffset: { x: number; y: number }
  enhanceFilter: string | undefined
  isScreenshotDragging: boolean
  activeTool: EditorTool
  placementDims: PlacementDims | null
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onSelect: (e: React.MouseEvent) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

export function ScreenshotMockup({
  screenshot,
  mockupAsset,
  mockupSpec,
  screenshotLayer,
  transform,
  shadowFilter,
  screenshotOffset,
  enhanceFilter,
  isScreenshotDragging,
  activeTool,
  placementDims,
  stageRef,
  imageRef,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
}: ScreenshotMockupProps) {
  // For device frames the shadow must follow the alpha silhouette of the
  // frame PNG (rounded corners, notch, etc). drop-shadow filters do that;
  // box-shadow would cast a rectangular shadow off the bounding box.
  const combinedFilter =
    [shadowFilter, enhanceFilter].filter(Boolean).join(" ") || undefined
  return (
    <div
      className="pointer-events-none flex h-full w-full items-center justify-center"
      style={{
        transform: `translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform}`,
      }}
    >
      <div
        className={cn(
          "pointer-events-auto relative max-h-full max-w-full select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-transform duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        style={{
          aspectRatio: mockupSpec.aspectRatio,
          height: "100%",
          width: "auto",
          filter: combinedFilter,
          opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
          mixBlendMode: screenshotLayer.blendMode,
        }}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div
            ref={stageRef}
            className="pointer-events-none w-full overflow-clip bg-black"
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(
                mockupSpec.screen,
                placementDims?.stageW
              ),
              transform: mockupScreenTransform(mockupSpec.screen),
            }}
          >
            <img
              ref={imageRef}
              src={screenshot}
              alt="Screenshot"
              draggable={false}
              onLoad={onImageLoad}
              className="pointer-events-none h-full w-full max-w-none object-cover object-center select-none"
            />
          </div>
        </div>
        <img
          src={mockupAsset.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />
      </div>
    </div>
  )
}
