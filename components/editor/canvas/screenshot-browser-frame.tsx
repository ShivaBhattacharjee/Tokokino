"use client"

import * as React from "react"

import { EmptyStateBackdrop } from "@/components/editor/canvas/empty-state-backdrop"
import { ScreenshotEditMenu } from "@/components/editor/canvas/screenshot-edit-menu"
import {
  UploadCard,
  type CaptureDevice,
  type CaptureSettings,
} from "@/components/editor/canvas/upload-card"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
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
import {
  frameFitStyle,
  framePositionedStyle,
  framePositionTransform,
} from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"

type SelectEvent = {
  stopPropagation: () => void
}

type ImageFit = "contain" | "cover" | "fill"

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
  objectFit?: ImageFit
  isScreenshotSelected: boolean
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
  onCaptureWebsite?: (
    url: string,
    settings: CaptureSettings
  ) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureStateKey?: string
  showHoverActions?: boolean
  innerLightingStyle?: React.CSSProperties | null
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
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  defaultCaptureDevice?: CaptureDevice
  captureStateKey?: string
  innerLightingStyle?: React.CSSProperties | null
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
  objectFit = "cover",
  isScreenshotSelected,
  isScreenshotDragging,
  hoverActionsDisabled,
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
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureStateKey,
  showHoverActions = true,
  innerLightingStyle,
}: ScreenshotBrowserFrameProps) {
  const frameRef = React.useRef<HTMLDivElement>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const frame = getBrowserFrame(frameId)
  const aspectRatio = frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO
  const fitStyle = frameFitStyle(aspectRatio)
  const positionedStyle = framePositionedStyle({
    aspectRatio,
    anchor: screenshotAnchor,
    offset: screenshotOffset,
    transform,
    shadowFilter,
    enhanceFilter,
    layer: screenshotLayer,
  })
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
          isScreenshotDragging || activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        style={positionedStyle}
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
            imageFit={objectFit}
            shimmer={false}
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
            imageFit={objectFit}
            shimmer={false}
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
            imageFit={objectFit}
            shimmer={false}
            className="h-full w-full"
          />
        )}

        <InnerLightingOverlay
          style={innerLightingStyle}
          className="overflow-hidden rounded-[inherit]"
        />
      </div>
      {showHoverActions &&
      activeTool === "pointer" &&
      !screenshotLayer.hidden ? (
        <div
          className="pointer-events-none absolute top-0 left-0 max-h-full max-w-full"
          style={{
            ...fitStyle,
            left: "50%",
            top: "50%",
            transform: framePositionTransform({
              anchor: screenshotAnchor,
              offset: screenshotOffset,
              transform,
            }),
            transformOrigin: "center",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
              editOpen || isScreenshotSelected
                ? "opacity-100"
                : "opacity-0 group-hover/browser-frame:opacity-100",
              isScreenshotDragging && !editOpen && "!opacity-0",
              hoverActionsDisabled && !editOpen && "!opacity-0"
            )}
          >
            <ScreenshotEditMenu
              open={editOpen}
              onOpenChange={(open) => {
                if (hoverActionsDisabled) {
                  setEditOpen(false)
                  return
                }
                setEditOpen(open)
              }}
              onCrop={onCropClick}
              onReplaceFile={onReplaceFile}
              onDelete={onDelete}
              onCaptureWebsite={onCaptureWebsite}
              onLoadTweet={onLoadTweet}
              captureDefaultDevice={captureDefaultDevice}
              captureStateKey={captureStateKey}
            />
          </div>
        </div>
      ) : null}
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
  onCapture,
  defaultCaptureDevice,
  captureStateKey,
  innerLightingStyle,
}: BrowserFrameEmptyStateProps) {
  const [url, setUrl] = React.useState("")
  const frame = getBrowserFrame(frameId)
  const aspectRatio = frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO
  const fitStyle = frameFitStyle(aspectRatio)
  const positionedStyle = framePositionedStyle({
    aspectRatio,
    anchor: screenshotAnchor,
    offset: screenshotOffset,
    transform,
    shadowFilter,
    enhanceFilter,
  })

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
          isScreenshotDragging || activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        style={positionedStyle}
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
              onCapture={onCapture}
              defaultCaptureDevice={defaultCaptureDevice}
              captureStateKey={captureStateKey}
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
              onCapture={onCapture}
              defaultCaptureDevice={defaultCaptureDevice}
              captureStateKey={captureStateKey}
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
              onCapture={onCapture}
              defaultCaptureDevice={defaultCaptureDevice}
              captureStateKey={captureStateKey}
              compact={compact}
            />
          </Safari>
        )}

        <InnerLightingOverlay
          style={innerLightingStyle}
          className="overflow-hidden rounded-[inherit]"
        />
      </div>
      {compact ? (
        <div
          className="pointer-events-none absolute top-0 left-0 max-h-full max-w-full"
          style={{
            ...fitStyle,
            left: "50%",
            top: "50%",
            transform: framePositionTransform({
              anchor: screenshotAnchor,
              offset: screenshotOffset,
              transform: "",
            }),
            transformOrigin: "center",
          }}
        >
          <BrowserFrameCompactUpload
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={onCapture}
            defaultCaptureDevice={defaultCaptureDevice}
            captureStateKey={captureStateKey}
          />
        </div>
      ) : null}
    </div>
  )
}

export function browserFrameColorFromValue(color: string) {
  return resolveBrowserFrameColor(color)
}

function BrowserFrameEmptyContent({
  isDragOver,
  onBrowse,
  onCapture,
  defaultCaptureDevice,
  captureStateKey,
  compact = false,
}: {
  isDragOver: boolean
  url: string
  onUrlChange: (url: string) => void
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  defaultCaptureDevice?: CaptureDevice
  captureStateKey?: string
  compact?: boolean
}) {
  return (
    <div className="relative size-full">
      <EmptyStateBackdrop
        data-drag-over={isDragOver}
        className={cn(
          "flex size-full items-center justify-center text-white transition-all",
          compact && "pointer-events-none",
          "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/40"
        )}
      >
        {compact ? null : (
          <UploadCard
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={onCapture}
            defaultDevice={defaultCaptureDevice}
            captureStateKey={captureStateKey}
            showHint
            className="w-full max-w-[400px]"
          />
        )}
      </EmptyStateBackdrop>
    </div>
  )
}

function BrowserFrameCompactUpload({
  isDragOver,
  onBrowse,
  onCapture,
  defaultCaptureDevice,
  captureStateKey,
}: {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  defaultCaptureDevice?: CaptureDevice
  captureStateKey?: string
}) {
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      onPointerDownCapture={stopPointer}
      onPointerMoveCapture={stopPointer}
      onPointerUpCapture={stopPointer}
    >
      <UploadCard
        compact
        isDragOver={isDragOver}
        onBrowse={onBrowse}
        onCapture={onCapture}
        defaultDevice={defaultCaptureDevice}
        captureStateKey={captureStateKey}
        showHint
      />
    </div>
  )
}
