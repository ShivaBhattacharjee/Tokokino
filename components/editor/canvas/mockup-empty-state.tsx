"use client"

import * as React from "react"

import { ShimmerImage } from "@/components/ui/shimmer-image"
import { cn } from "@/lib/utils"
import type { EditorTool } from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import { BoxEmptyState } from "./box-empty-state"
import type { CaptureDevice, CaptureSettings } from "./upload-card"
import {
  framePositionedStyle,
  isDesktopMockup,
  mockupScreenClipStyle,
  mockupScreenTransform,
} from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type MockupEmptyStateProps = {
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
  shadowFilter?: string
  enhanceFilter?: string
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  compact?: boolean
  /** Cap frame size to min(cqw, cqh) so it stays consistent across canvas aspect ratios. */
  scopeToMinSide?: boolean
  innerLightingStyle?: React.CSSProperties | null
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  defaultCaptureDevice?: CaptureDevice
  defaultCaptureOrientation?: "vertical" | "horizontal"
  captureStateKey?: string
}

export function MockupEmptyState({
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
  shadowFilter,
  enhanceFilter,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  compact = false,
  scopeToMinSide = false,
  innerLightingStyle,
  onCapture,
  defaultCaptureDevice,
  defaultCaptureOrientation,
  captureStateKey,
}: MockupEmptyStateProps) {
  const screenRef = React.useRef<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = React.useState<number | undefined>(
    undefined
  )
  const desktopFrame = isDesktopMockup(mockupAsset.deviceId)

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
    <div
      className="pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
    >
      <div
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        style={framePositionedStyle({
          aspectRatio: mockupSpec.aspectRatio,
          rotation: mockupRotation,
          scopeToMinSide,
          anchor: screenshotAnchor,
          offset: screenshotOffset,
          transform,
          shadowFilter,
          enhanceFilter,
        })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div
            ref={screenRef}
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
              transform: mockupScreenTransform(mockupSpec.screen),
            }}
            className="pointer-events-auto relative w-full overflow-hidden"
          >
            <BoxEmptyState
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              onCapture={onCapture}
              defaultCaptureDevice={defaultCaptureDevice}
              defaultCaptureOrientation={defaultCaptureOrientation}
              captureStateKey={captureStateKey}
              contentRotation={mockupRotation ? -mockupRotation : 0}
              compact={compact || !desktopFrame}
              plainWideCard={desktopFrame}
            />
            <InnerLightingOverlay style={innerLightingStyle} />
          </div>
        </div>
        <ShimmerImage
          shimmer={false}
          src={mockupAsset.src}
          alt=""
          draggable={false}
          data-editor-enhance-filter=""
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />
      </div>
    </div>
  )
}
