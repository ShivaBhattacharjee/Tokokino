"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { EditorTool } from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import { DeviceFrameEmptyContent } from "./device-frame-empty-content"
import { mockupScreenClipStyle, mockupScreenTransform } from "./helpers"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type DeviceFrameEmptyStateProps = {
  mockupAsset: DeviceMockupAsset
  mockupSpec: DeviceMockupSpec
  isDragOver: boolean
  onBrowse: () => void
  transform: string
  mockupRotation: number
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  isScreenshotDragging: boolean
  activeTool: EditorTool
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function DeviceFrameEmptyState({
  mockupAsset,
  mockupSpec,
  isDragOver,
  onBrowse,
  transform,
  mockupRotation,
  screenshotOffset,
  screenshotAnchor,
  isScreenshotDragging,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DeviceFrameEmptyStateProps) {
  const screenRef = React.useRef<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = React.useState<number | undefined>(
    undefined
  )
  const [url, setUrl] = React.useState("")

  React.useLayoutEffect(() => {
    const node = screenRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setStageWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="pointer-events-none relative h-full w-full">
      <div
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        style={{
          aspectRatio: mockupSpec.aspectRatio,
          height: "100%",
          width: "auto",
          left: `${screenshotAnchor.x}%`,
          top: `${screenshotAnchor.y}%`,
          transform: `translate(-${screenshotAnchor.x}%, -${screenshotAnchor.y}%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform} rotate(${mockupRotation}deg)`,
          transformOrigin: "center",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div
            ref={screenRef}
            data-drag-over={isDragOver}
            className={cn(
              "pointer-events-auto relative w-full overflow-hidden bg-black text-white",
              "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/60"
            )}
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
              transform: mockupScreenTransform(mockupSpec.screen),
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "16px 16px",
              containerType: "inline-size",
            }}
          >
            <DeviceFrameEmptyContent
              url={url}
              onUrlChange={setUrl}
              onBrowse={onBrowse}
              style={
                mockupRotation
                  ? { transform: `rotate(${-mockupRotation}deg)` }
                  : undefined
              }
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
