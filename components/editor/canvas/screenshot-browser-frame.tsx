"use client"

import * as React from "react"
import { RiAddLine } from "@remixicon/react"

import { EmptyStateBackdrop } from "@/components/editor/canvas/empty-state-backdrop"
import { ScreenshotEditMenu } from "@/components/editor/canvas/screenshot-edit-menu"
import { UploadCard } from "@/components/editor/canvas/upload-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  const [editOpen, setEditOpen] = React.useState(false)
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

      </div>
      {showHoverActions && activeTool === "pointer" && !screenshotLayer.hidden ? (
        <div
          className="pointer-events-none absolute top-0 left-0 max-h-full max-w-full"
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
          }}
        >
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
              editOpen
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
      {compact ? (
        <div
          className="pointer-events-none absolute top-0 left-0 max-h-full max-w-full"
          style={{
            ...frameFitStyle,
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
          />
        </div>
      ) : null}
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
}: {
  isDragOver: boolean
  onBrowse: () => void
}) {
  const stopPointer = (e: React.PointerEvent) => e.stopPropagation()
  const stopClick = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add screenshot"
            onPointerDownCapture={stopPointer}
            onPointerMoveCapture={stopPointer}
            onPointerUpCapture={stopPointer}
            onPointerDown={stopPointer}
            onPointerMove={stopPointer}
            onPointerUp={stopPointer}
            onClick={stopClick}
            className="group pointer-events-auto grid size-28 cursor-pointer place-items-center border-0 bg-transparent p-0"
          >
            <span className="grid size-16 place-items-center rounded-2xl border-2 border-primary bg-neutral-900/95 text-white shadow-[0_0_0_4px_rgba(0,0,0,0.4),0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-all group-hover:scale-105 group-hover:bg-neutral-800 group-active:scale-95 group-data-[state=open]:scale-105">
              <RiAddLine className="size-8" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          onPointerDown={stopPointer}
          className="w-[320px] rounded-2xl border border-white/10 bg-neutral-900 p-0 text-white shadow-2xl"
        >
          <UploadCard
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            showHint
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
