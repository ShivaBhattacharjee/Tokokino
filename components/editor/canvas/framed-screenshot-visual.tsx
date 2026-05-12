"use client"

import * as React from "react"

import { BoxEmptyState } from "@/components/editor/canvas/box-empty-state"
import { DeviceFrameEmptyContent } from "@/components/editor/canvas/device-frame-empty-content"
import { Arc } from "@/components/ui/arc"
import { Chrome } from "@/components/ui/chrome"
import { Safari } from "@/components/ui/safari"
import {
  ARC_BROWSER_FRAME_ID,
  CHROME_BROWSER_FRAME_ID,
  isBrowserFrame,
  resolveBrowserFrameColor,
} from "@/lib/browser-frame"
import type { DeviceFrame } from "@/lib/editor/state-types"
import { getDeviceMockup, getDeviceMockupAsset } from "@/lib/mockups"
import { cn } from "@/lib/utils"

import {
  deviceMockupSpec,
  frameFitStyle,
  mockupScreenClipStyle,
  mockupScreenTransform,
} from "./helpers"

type FramedScreenshotVisualProps = {
  src: string | null
  frame: DeviceFrame
  onBrowse: () => void
  isDragOver?: boolean
  imageFilter?: string
  shadowFilter?: string
  borderRadius?: number
  outline?: {
    width: number
    style?: string
    color: string | null
    padding?: number
  }
  addressValue?: string
  onAddressChange?: (value: string) => void
}

export function FramedScreenshotVisual({
  src,
  frame,
  onBrowse,
  isDragOver,
  imageFilter,
  shadowFilter,
  borderRadius,
  outline,
  addressValue,
  onAddressChange,
}: FramedScreenshotVisualProps) {
  if (isBrowserFrame(frame.id)) {
    return (
      <BrowserFrameVisual
        src={src}
        frame={frame}
        onBrowse={onBrowse}
        imageFilter={imageFilter}
        shadowFilter={shadowFilter}
        addressValue={addressValue}
        onAddressChange={onAddressChange}
      />
    )
  }

  if (frame.id !== "none") {
    return (
      <DeviceFrameVisual
        src={src}
        frame={frame}
        onBrowse={onBrowse}
        imageFilter={imageFilter}
        shadowFilter={shadowFilter}
      />
    )
  }

  return (
    <BareVisual
      src={src}
      onBrowse={onBrowse}
      isDragOver={isDragOver}
      imageFilter={imageFilter}
      borderRadius={borderRadius}
      shadowFilter={shadowFilter}
      outline={outline}
    />
  )
}

function BareVisual({
  src,
  onBrowse,
  isDragOver,
  imageFilter,
  borderRadius,
  shadowFilter,
  outline,
}: {
  src: string | null
  onBrowse: () => void
  isDragOver?: boolean
  imageFilter?: string
  borderRadius?: number
  shadowFilter?: string
  outline?: FramedScreenshotVisualProps["outline"]
}) {
  const style: React.CSSProperties = {
    borderRadius,
    filter: shadowFilter,
  }
  if (outline?.color && outline.width > 0) {
    style.outline = `${outline.width}px ${outline.style || "solid"} ${outline.color}`
    style.outlineOffset = `${outline.padding || 0}px`
  }
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black/40"
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="block h-full w-full object-cover select-none"
          style={{ filter: imageFilter || undefined }}
        />
      ) : (
        <BoxEmptyState isDragOver={isDragOver} onBrowse={onBrowse} />
      )}
    </div>
  )
}

function BrowserFrameVisual({
  src,
  frame,
  onBrowse,
  imageFilter,
  shadowFilter,
  addressValue,
  onAddressChange,
}: {
  src: string | null
  frame: DeviceFrame
  onBrowse: () => void
  imageFilter?: string
  shadowFilter?: string
  addressValue?: string
  onAddressChange?: (value: string) => void
}) {
  const color = resolveBrowserFrameColor(frame.color)
  const colorMode = color === "dark" ? "dark" : "light"
  const style: React.CSSProperties = {
    filter: [shadowFilter, imageFilter].filter(Boolean).join(" ") || undefined,
  }
  const emptyContent = !src ? (
    <DeviceFrameEmptyContent onBrowse={onBrowse} />
  ) : null

  if (frame.id === ARC_BROWSER_FRAME_ID) {
    return (
      <Arc
        imageSrc={src ?? undefined}
        colorMode={colorMode}
        className="h-full w-full"
        style={style}
      >
        {emptyContent}
      </Arc>
    )
  }

  if (frame.id === CHROME_BROWSER_FRAME_ID) {
    return (
      <Chrome
        imageSrc={src ?? undefined}
        colorMode={colorMode}
        addressValue={addressValue}
        onAddressChange={onAddressChange}
        className="h-full w-full"
        style={style}
      >
        {emptyContent}
      </Chrome>
    )
  }

  return (
    <Safari
      imageSrc={src ?? undefined}
      colorMode={colorMode}
      addressValue={addressValue}
      onAddressChange={onAddressChange}
      className="h-full w-full"
      style={style}
    >
      {emptyContent}
    </Safari>
  )
}

function DeviceFrameVisual({
  src,
  frame,
  onBrowse,
  imageFilter,
  shadowFilter,
}: {
  src: string | null
  frame: DeviceFrame
  onBrowse: () => void
  imageFilter?: string
  shadowFilter?: string
}) {
  const mockupDevice = getDeviceMockup(frame.id)
  const orientation = mockupDevice?.orientations.includes("portrait")
    ? "portrait"
    : "landscape"
  const rotation =
    frame.orientation === "horizontal" && orientation === "portrait" ? -90 : 0
  const mockupAsset = getDeviceMockupAsset(frame.id, frame.color, orientation)
  const spec = mockupAsset ? deviceMockupSpec(frame.id) : null
  const horizontalScreenStyle = rotation
    ? rotatedScreenContentStyle(spec?.screen.aspectRatio, -rotation)
    : undefined

  if (!mockupAsset || !spec) {
    return (
      <BareVisual
        src={src}
        onBrowse={onBrowse}
        imageFilter={imageFilter}
        shadowFilter={shadowFilter}
      />
    )
  }

  return (
    <div className="relative h-full w-full" style={{ containerType: "size" }}>
      <div
        className="absolute top-1/2 left-1/2 max-h-full max-w-full"
        style={{
          ...frameFitStyle(spec.aspectRatio),
          transform: `translate(-50%, -50%)${
            rotation ? ` rotate(${rotation}deg)` : ""
          }`,
          filter:
            [shadowFilter, imageFilter].filter(Boolean).join(" ") || undefined,
        }}
      >
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{
              aspectRatio: spec.screen.aspectRatio,
              ...mockupScreenClipStyle(spec.screen),
              transform: mockupScreenTransform(spec.screen),
              containerType: "inline-size",
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                draggable={false}
                className={cn(
                  "pointer-events-none max-w-none object-cover object-center select-none",
                  rotation ? "absolute top-1/2 left-1/2" : "h-full w-full"
                )}
                style={horizontalScreenStyle}
              />
            ) : (
              <DeviceFrameEmptyContent onBrowse={onBrowse} />
            )}
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

function rotatedScreenContentStyle(
  aspectRatio: string | undefined,
  rotation: number
): React.CSSProperties | undefined {
  if (!aspectRatio) return undefined
  const [w, h] = aspectRatio.split("/").map((part) => Number(part.trim()))
  if (!w || !h) return undefined
  const scale = Math.max(w / h, h / w)
  return {
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
}
