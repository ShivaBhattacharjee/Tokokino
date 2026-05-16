"use client"

import * as React from "react"

import { BoxHoverActions } from "@/components/editor/canvas/box-hover-actions"
import { BoxEmptyState } from "@/components/editor/canvas/box-empty-state"
import { Arc } from "@/components/ui/arc"
import { Chrome } from "@/components/ui/chrome"
import { Safari } from "@/components/ui/safari"
import {
  ARC_BROWSER_FRAME_ID,
  BROWSER_FRAME_ASPECT_RATIO,
  CHROME_BROWSER_FRAME_ID,
  getBrowserFrame,
  resolveBrowserFrameColor,
  type BrowserFrameColor,
} from "@/lib/browser-frame"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import { cn } from "@/lib/utils"
import { framePositionTransform } from "./helpers"

type SelectEvent = {
  stopPropagation: () => void
}

type ScreenshotBrowserFrameProps = {
  screenshot: string
  frameId: string
  color: BrowserFrameColor
  screenshotLayer: ScreenshotLayer
  transform: string
  shadowFilter: string | undefined
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  enhanceFilter: string | undefined
  isScreenshotDragging: boolean
  hoverActionsDisabled?: boolean
  hoverActionsInline?: boolean
  hoverActionsLayoutKey?: string | number
  hoverActionsScale?: number
  activeTool: EditorTool
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  addressValue: string
  onAddressChange: (value: string) => void
  onSelect: (e: SelectEvent) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  showHoverActions?: boolean
}

type BrowserFrameEmptyStateProps = {
  frameId: string
  color: BrowserFrameColor
  isDragOver: boolean
  onBrowse: () => void
  transform: string
  shadowFilter?: string
  enhanceFilter?: string
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  isScreenshotDragging: boolean
  activeTool: EditorTool
  addressValue: string
  onAddressChange: (value: string) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  compact?: boolean
}

export function ScreenshotBrowserFrame({
  screenshot,
  frameId,
  color,
  screenshotLayer,
  transform,
  shadowFilter,
  screenshotOffset,
  screenshotAnchor,
  enhanceFilter,
  isScreenshotDragging,
  hoverActionsDisabled,
  hoverActionsInline,
  hoverActionsLayoutKey,
  hoverActionsScale,
  activeTool,
  stageRef,
  imageRef,
  addressValue,
  onAddressChange,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
  showHoverActions = true,
}: ScreenshotBrowserFrameProps) {
  const frameRef = React.useRef<HTMLDivElement>(null)
  const frame = getBrowserFrame(frameId)
  const frameFitStyle = browserFrameFitStyle(
    frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO
  )
  return (
    <div
      data-box-hover-target
      className="group/browser-frame pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
    >
      <div
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        data-editor-enhance-filter={enhanceFilter || ""}
        ref={frameRef}
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        style={{
          ...frameFitStyle,
          left: "50%",
          top: "50%",
          transform: framePositionTransform({
            anchor: screenshotAnchor,
            offset: screenshotOffset,
            transform,
          }),
          transformOrigin: "center",
          transformStyle: "preserve-3d",
          filter:
            [shadowFilter, enhanceFilter].filter(Boolean).join(" ") ||
            undefined,
          opacity: screenshotLayer.hidden ? 0 : screenshotLayer.opacity / 100,
          mixBlendMode:
            screenshotLayer.blendMode && screenshotLayer.blendMode !== "normal"
              ? screenshotLayer.blendMode
              : undefined,
        }}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return
          e.preventDefault()
          onSelect(e)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={activeTool === "pointer" && !screenshotLayer.hidden ? 0 : -1}
        aria-label="Select browser screenshot"
      >
        {frameId === ARC_BROWSER_FRAME_ID ? (
          <Arc
            imageSrc={screenshot}
            colorMode={color === "dark" ? "dark" : "light"}
            screenRef={stageRef}
            imageRef={imageRef}
            onImageLoad={onImageLoad}
            className="h-full w-full"
          />
        ) : frameId === CHROME_BROWSER_FRAME_ID ? (
          <Chrome
            imageSrc={screenshot}
            colorMode={color === "dark" ? "dark" : "light"}
            addressValue={addressValue}
            onAddressChange={onAddressChange}
            screenRef={stageRef}
            imageRef={imageRef}
            onImageLoad={onImageLoad}
            className="h-full w-full"
          />
        ) : (
          <Safari
            imageSrc={screenshot}
            colorMode={color === "dark" ? "dark" : "light"}
            addressValue={addressValue}
            onAddressChange={onAddressChange}
            screenRef={stageRef}
            imageRef={imageRef}
            onImageLoad={onImageLoad}
            className="h-full w-full"
          />
        )}

        {showHoverActions &&
        activeTool === "pointer" &&
        !screenshotLayer.hidden ? (
          <BoxHoverActions
            hoverGroupClass={cn(
              "group-hover/browser-frame:opacity-100",
              isScreenshotDragging && "!opacity-0"
            )}
            disabled={hoverActionsDisabled}
            inline={hoverActionsInline}
            layoutKey={hoverActionsLayoutKey}
            controlScale={hoverActionsInline ? 1 : hoverActionsScale}
            measureRef={stageRef}
            onCrop={onCropClick}
            onReplaceFile={onReplaceFile}
            onDelete={onDelete}
          />
        ) : null}
      </div>
    </div>
  )
}

export function BrowserFrameEmptyState({
  frameId,
  color,
  isDragOver,
  onBrowse,
  transform,
  shadowFilter,
  enhanceFilter,
  screenshotOffset,
  screenshotAnchor,
  isScreenshotDragging,
  activeTool,
  addressValue,
  onAddressChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  compact = false,
}: BrowserFrameEmptyStateProps) {
  const [url, setUrl] = React.useState("")
  const frame = getBrowserFrame(frameId)
  const frameFitStyle = browserFrameFitStyle(
    frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO
  )

  return (
    <div
      className="pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
    >
      <div
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        data-editor-enhance-filter={enhanceFilter || ""}
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        style={{
          ...frameFitStyle,
          left: "50%",
          top: "50%",
          transform: framePositionTransform({
            anchor: screenshotAnchor,
            offset: screenshotOffset,
            transform,
          }),
          transformOrigin: "center",
          transformStyle: "preserve-3d",
          filter:
            [shadowFilter, enhanceFilter].filter(Boolean).join(" ") ||
            undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {frameId === ARC_BROWSER_FRAME_ID ? (
          <Arc
            colorMode={color === "dark" ? "dark" : "light"}
            className="h-full w-full"
          >
            <BrowserFrameEmptyContent
              isDragOver={isDragOver}
              url={url}
              onUrlChange={setUrl}
              onBrowse={onBrowse}
              compact={compact}
            />
          </Arc>
        ) : frameId === CHROME_BROWSER_FRAME_ID ? (
          <Chrome
            colorMode={color === "dark" ? "dark" : "light"}
            addressValue={addressValue}
            onAddressChange={onAddressChange}
            className="h-full w-full"
          >
            <BrowserFrameEmptyContent
              isDragOver={isDragOver}
              url={url}
              onUrlChange={setUrl}
              onBrowse={onBrowse}
              compact={compact}
            />
          </Chrome>
        ) : (
          <Safari
            colorMode={color === "dark" ? "dark" : "light"}
            addressValue={addressValue}
            onAddressChange={onAddressChange}
            className="h-full w-full"
          >
            <BrowserFrameEmptyContent
              isDragOver={isDragOver}
              url={url}
              onUrlChange={setUrl}
              onBrowse={onBrowse}
              compact={compact}
            />
          </Safari>
        )}
      </div>
    </div>
  )
}

export function browserFrameColorFromValue(color: string) {
  return resolveBrowserFrameColor(color)
}

function browserFrameFitStyle(aspectRatio: string): React.CSSProperties {
  const ratio = parseAspectRatio(aspectRatio) ?? 16 / 10

  return {
    aspectRatio,
    width: `min(100cqw, calc(100cqh * ${ratio}))`,
    height: "auto",
  }
}

function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio
    .split("/")
    .map((part) => Number(part.trim()))

  if (!width || !height) return null
  return width / height
}

function BrowserFrameEmptyContent({
  isDragOver,
  onBrowse,
  compact = false,
}: {
  isDragOver: boolean
  url: string
  onUrlChange: (url: string) => void
  onBrowse: () => void
  compact?: boolean
}) {
  return (
    <BoxEmptyState
      isDragOver={isDragOver}
      onBrowse={onBrowse}
      compact={compact}
    />
  )
}
