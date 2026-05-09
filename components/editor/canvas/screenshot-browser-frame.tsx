"use client"

import * as React from "react"
import { RiCropLine, RiDeleteBinLine, RiRefreshLine } from "@remixicon/react"

import { DeviceFrameEmptyContent } from "@/components/editor/canvas/device-frame-empty-content"
import { Chrome } from "@/components/ui/chrome"
import { Safari } from "@/components/ui/safari"
import {
  BROWSER_FRAME_ASPECT_RATIO,
  CHROME_BROWSER_FRAME_ID,
  getBrowserFrame,
  resolveBrowserFrameColor,
  type BrowserFrameColor,
} from "@/lib/browser-frame"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

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
  activeTool: EditorTool
  stageRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  onSelect: (e: React.MouseEvent) => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
}

type BrowserFrameEmptyStateProps = {
  frameId: string
  color: BrowserFrameColor
  isDragOver: boolean
  onBrowse: () => void
  transform: string
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
  isScreenshotDragging: boolean
  activeTool: EditorTool
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
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
  activeTool,
  stageRef,
  imageRef,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onImageLoad,
  onCropClick,
  onReplaceFile,
  onDelete,
}: ScreenshotBrowserFrameProps) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const [address, setAddress] = React.useState("")
  const frame = getBrowserFrame(frameId)
  const FrameComponent = frameId === CHROME_BROWSER_FRAME_ID ? Chrome : Safari
  const combinedFilter =
    [shadowFilter, enhanceFilter].filter(Boolean).join(" ") || undefined

  return (
    <div className="group/browser-frame pointer-events-none relative h-full w-full">
      <div
        className={cn(
          "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
          screenshotLayer.hidden && "pointer-events-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-all duration-300 ease-out",
          activeTool === "pointer" && "cursor-grab"
        )}
        style={{
          aspectRatio: frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO,
          height: "100%",
          width: "auto",
          left: `${screenshotAnchor.x}%`,
          top: `${screenshotAnchor.y}%`,
          transform: `translate(-${screenshotAnchor.x}%, -${screenshotAnchor.y}%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform}`,
          transformOrigin: "center",
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
        <FrameComponent
          imageSrc={screenshot}
          colorMode={color === "dark" ? "dark" : "light"}
          addressValue={address}
          onAddressChange={setAddress}
          screenRef={stageRef}
          imageRef={imageRef}
          onImageLoad={onImageLoad}
          className="h-full w-full"
        />

        {activeTool === "pointer" && !screenshotLayer.hidden ? (
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover/browser-frame:opacity-100",
              isScreenshotDragging && "!opacity-0"
            )}
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
            <FrameActionButton label="Crop image" onClick={onCropClick}>
              <RiCropLine className="size-4" />
            </FrameActionButton>
            <FrameActionButton
              label="Replace image"
              onClick={() => replaceInputRef.current?.click()}
            >
              <RiRefreshLine className="size-4" />
            </FrameActionButton>
            <FrameActionButton
              label="Delete image"
              destructive
              onClick={onDelete}
            >
              <RiDeleteBinLine className="size-4" />
            </FrameActionButton>
          </div>
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
  screenshotOffset,
  screenshotAnchor,
  isScreenshotDragging,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BrowserFrameEmptyStateProps) {
  const [url, setUrl] = React.useState("")
  const [address, setAddress] = React.useState("")
  const frame = getBrowserFrame(frameId)
  const FrameComponent = frameId === CHROME_BROWSER_FRAME_ID ? Chrome : Safari

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
          aspectRatio: frame?.aspectRatio ?? BROWSER_FRAME_ASPECT_RATIO,
          height: "100%",
          width: "auto",
          left: `${screenshotAnchor.x}%`,
          top: `${screenshotAnchor.y}%`,
          transform: `translate(-${screenshotAnchor.x}%, -${screenshotAnchor.y}%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform}`,
          transformOrigin: "center",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <FrameComponent
          colorMode={color === "dark" ? "dark" : "light"}
          addressValue={address}
          onAddressChange={setAddress}
          className="h-full w-full"
        >
          <div
            data-drag-over={isDragOver}
            className={cn(
              "relative size-full bg-black text-white transition-all duration-200",
              "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/60"
            )}
            style={{
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
            />
          </div>
        </FrameComponent>
      </div>
    </div>
  )
}

function FrameActionButton({
  label,
  destructive,
  onClick,
  children,
}: {
  label: string
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/85",
        destructive && "hover:bg-red-500/90"
      )}
    >
      {children}
    </button>
  )
}

export function browserFrameColorFromValue(color: string) {
  return resolveBrowserFrameColor(color)
}
