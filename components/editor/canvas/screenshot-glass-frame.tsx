"use client"

import * as React from "react"

import { EmptyStateBackdrop } from "@/components/editor/canvas/empty-state-backdrop"
import { ScreenshotEditMenu } from "@/components/editor/canvas/screenshot-edit-menu"
import {
  UploadCard,
  type CaptureDevice,
  type CaptureSettings,
} from "@/components/editor/canvas/upload-card"
import { GlassFrame } from "@/components/ui/glass-frame"
import { useAnimationPlayerOptional } from "@/hooks/use-animation-player"
import { isVideoSrc } from "@/lib/editor/media-type"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import { getGlassFrame, type GlassFrameColor } from "@/lib/glass-frame"
import { cn } from "@/lib/utils"

import {
  frameFitStyle,
  framePositionedStyle,
  framePositionTransform,
} from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"

type SelectEvent = { stopPropagation: () => void }
type ImageFit = "contain" | "cover" | "fill"

type ScreenshotGlassFrameProps = {
  screenshot: string
  frameId: string
  color: GlassFrameColor
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
  activeTool: EditorTool
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onSelect: (event: SelectEvent) => void
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onWheel?: React.WheelEventHandler<HTMLDivElement>
  onImageLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void
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
  readMainPreviewVars?: boolean
  innerLightingStyle?: React.CSSProperties | null
  onMediaElement?: (element: HTMLVideoElement | null) => void
  mediaStyle?: React.CSSProperties
}

type GlassFrameEmptyStateProps = {
  frameId: string
  color: GlassFrameColor
  isDragOver: boolean
  onBrowse: () => void
  transform: string
  shadowFilter?: string
  enhanceFilter?: string
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  isScreenshotDragging: boolean
  activeTool: EditorTool
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  compact?: boolean
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  onDemo?: (src: string) => void | Promise<void>
  defaultCaptureDevice?: CaptureDevice
  captureStateKey?: string
  readMainPreviewVars?: boolean
  innerLightingStyle?: React.CSSProperties | null
  allowVideo?: boolean
}

export function ScreenshotGlassFrame({
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
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureStateKey,
  showHoverActions = true,
  readMainPreviewVars = true,
  innerLightingStyle,
  onMediaElement,
  mediaStyle,
}: ScreenshotGlassFrameProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const animationPlayer = useAnimationPlayerOptional()
  const isAnimationPlaying = animationPlayer?.isPlaying ?? false
  const frame = getGlassFrame(frameId)
  if (!frame) return null

  const fitStyle = frameFitStyle(frame.aspectRatio)
  const positionedStyle = framePositionedStyle({
    aspectRatio: frame.aspectRatio,
    anchor: screenshotAnchor,
    offset: screenshotOffset,
    transform,
    shadowFilter,
    enhanceFilter,
    layer: screenshotLayer,
    readPreviewVars: readMainPreviewVars,
  })
  const isVideo = isVideoSrc(screenshot)

  return (
    <div
      data-box-hover-target
      className="group/glass-frame pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
    >
      <div
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        data-editor-enhance-filter={enhanceFilter || ""}
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging || activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-[transform,opacity,filter,box-shadow] duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        style={positionedStyle}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          onSelect(event)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="button"
        tabIndex={activeTool === "pointer" && !screenshotLayer.hidden ? 0 : -1}
        aria-label="Select glass screenshot"
      >
        <GlassFrame
          frameId={frameId}
          colorMode={color}
          imageSrc={isVideo ? undefined : screenshot}
          videoSrc={isVideo ? screenshot : undefined}
          screenRef={stageRef}
          imageRef={imageRef}
          onImageLoad={onImageLoad}
          onMediaElement={onMediaElement}
          mediaStyle={mediaStyle}
          imageFit={objectFit}
          shimmer
          className="h-full w-full"
          screenOverlay={<InnerLightingOverlay style={innerLightingStyle} />}
        />
      </div>

      {showHoverActions &&
      activeTool === "pointer" &&
      !isAnimationPlaying &&
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
              readPreviewVars: readMainPreviewVars,
            }),
            transformOrigin: "center",
          }}
        >
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
              editOpen || isScreenshotSelected
                ? "opacity-100"
                : "opacity-0 group-hover/glass-frame:opacity-100",
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

export function GlassFrameEmptyState({
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
  onPointerDown,
  onPointerMove,
  onPointerUp,
  compact = false,
  onCapture,
  onDemo,
  defaultCaptureDevice,
  captureStateKey,
  readMainPreviewVars = true,
  innerLightingStyle,
  allowVideo = true,
}: GlassFrameEmptyStateProps) {
  const frame = getGlassFrame(frameId)
  if (!frame) return null

  const fitStyle = frameFitStyle(frame.aspectRatio)
  const positionedStyle = framePositionedStyle({
    aspectRatio: frame.aspectRatio,
    anchor: screenshotAnchor,
    offset: screenshotOffset,
    transform,
    shadowFilter,
    enhanceFilter,
    readPreviewVars: readMainPreviewVars,
  })

  const uploadCard = (
    <EmptyStateBackdrop
      data-drag-over={isDragOver}
      className={cn(
        "flex size-full items-center justify-center transition-all",
        compact && "pointer-events-none",
        "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/40"
      )}
    >
      {compact ? null : (
        <UploadCard
          isDragOver={isDragOver}
          onBrowse={onBrowse}
          onCapture={onCapture}
          onDemo={onDemo}
          defaultDevice={defaultCaptureDevice}
          captureStateKey={captureStateKey}
          allowVideo={allowVideo}
          showHint
          className="w-full max-w-[400px]"
        />
      )}
    </EmptyStateBackdrop>
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
          isScreenshotDragging || activeTool === "position"
            ? "cursor-grabbing transition-none"
            : "transition-[transform,opacity,filter,box-shadow] duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        style={positionedStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GlassFrame
          frameId={frameId}
          colorMode={color}
          className="h-full w-full"
          screenOverlay={
            <>
              {uploadCard}
              <InnerLightingOverlay style={innerLightingStyle} />
            </>
          }
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
              readPreviewVars: readMainPreviewVars,
            }),
            transformOrigin: "center",
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <UploadCard
              compact
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              onCapture={onCapture}
              onDemo={onDemo}
              defaultDevice={defaultCaptureDevice}
              captureStateKey={captureStateKey}
              allowVideo={allowVideo}
              showHint
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
