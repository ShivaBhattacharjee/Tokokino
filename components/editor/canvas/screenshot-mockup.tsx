"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiArrowLeftLine,
  RiCameraLine,
  RiCropLine,
  RiDeleteBinLine,
  RiGlobeLine,
  RiPencilLine,
  RiRefreshLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { EditorTool, ScreenshotLayer } from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
  mockupRotation: number
  shadowFilter: string | undefined
  screenshotOffset: { x: number; y: number }
  screenshotAnchor: { x: number; y: number }
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
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onCaptureWebsite?: (url: string) => void
}

export function ScreenshotMockup({
  screenshot,
  mockupAsset,
  mockupSpec,
  screenshotLayer,
  transform,
  mockupRotation,
  shadowFilter,
  screenshotOffset,
  screenshotAnchor,
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
  onCropClick,
  onReplaceFile,
  onDelete,
  onCaptureWebsite,
}: ScreenshotMockupProps) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  const [view, setView] = React.useState<"menu" | "capture">("menu")
  const [captureUrl, setCaptureUrl] = React.useState("")
  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open)
    if (!open) {
      setView("menu")
      setCaptureUrl("")
    }
  }
  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = captureUrl.trim()
    if (!trimmed) return
    onCaptureWebsite?.(trimmed)
    handleEditOpenChange(false)
  }
  // For device frames the shadow must follow the alpha silhouette of the
  // frame PNG (rounded corners, notch, etc). drop-shadow filters do that;
  // box-shadow would cast a rectangular shadow off the bounding box.
  const combinedFilter =
    [shadowFilter, enhanceFilter].filter(Boolean).join(" ") || undefined
  const horizontalScreenStyle = mockupRotation
    ? rotatedScreenContentStyle(mockupSpec.screen.aspectRatio, -mockupRotation)
    : undefined

  return (
    <div className="group/mockup pointer-events-none relative h-full w-full">
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
          aspectRatio: mockupSpec.aspectRatio,
          height: "100%",
          width: "auto",
          left: `${screenshotAnchor.x}%`,
          top: `${screenshotAnchor.y}%`,
          transform: `translate(-${screenshotAnchor.x}%, -${screenshotAnchor.y}%) translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform} rotate(${mockupRotation}deg)`,
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
              className={cn(
                "pointer-events-none max-w-none object-cover object-center select-none",
                mockupRotation ? "absolute top-1/2 left-1/2" : "h-full w-full"
              )}
              style={horizontalScreenStyle}
            />
          </div>
        </div>
        <img
          src={mockupAsset.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />

        {activeTool === "pointer" && !screenshotLayer.hidden ? (
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
              editOpen
                ? "opacity-100"
                : "opacity-0 group-hover/mockup:opacity-100",
              isScreenshotDragging && !editOpen && "!opacity-0"
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
            <Popover open={editOpen} onOpenChange={handleEditOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Edit screenshot"
                  title="Edit screenshot"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/85"
                >
                  <RiPencilLine className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                side="bottom"
                sideOffset={10}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                asChild
                className={cn(
                  "rounded-xl border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-md",
                  view === "menu" ? "w-44" : "w-60 p-2"
                )}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    mass: 0.6,
                  }}
                  style={{ originY: 0 }}
                  className="flex flex-col gap-0.5"
                >
                  {view === "menu" ? (
                    <>
                      <EditMenuItem
                        index={0}
                        icon={<RiCropLine className="size-4" />}
                        label="Crop"
                        onClick={() => {
                          handleEditOpenChange(false)
                          onCropClick()
                        }}
                      />
                      <EditMenuItem
                        index={1}
                        icon={<RiRefreshLine className="size-4" />}
                        label="Replace"
                        hint="Press ⌘V to replace"
                        onClick={() => {
                          handleEditOpenChange(false)
                          replaceInputRef.current?.click()
                        }}
                      />
                      <EditMenuItem
                        index={2}
                        icon={<RiGlobeLine className="size-4" />}
                        label="Capture website"
                        onClick={() => setView("capture")}
                      />
                      <EditMenuItem
                        index={3}
                        icon={<RiDeleteBinLine className="size-4" />}
                        label="Delete"
                        destructive
                        onClick={() => {
                          handleEditOpenChange(false)
                          onDelete()
                        }}
                      />
                    </>
                  ) : (
                    <CaptureView
                      url={captureUrl}
                      onUrlChange={setCaptureUrl}
                      onBack={() => setView("menu")}
                      onSubmit={handleCaptureSubmit}
                    />
                  )}
                </motion.div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CaptureView({
  url,
  onUrlChange,
  onBack,
  onSubmit,
}: {
  url: string
  onUrlChange: (value: string) => void
  onBack: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const canSubmit = url.trim().length > 0
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-1 pt-1">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onBack()
          }}
          aria-label="Back"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" />
        </button>
        <span className="text-[12px] font-medium tracking-[-0.01em] text-foreground">
          Capture website
        </span>
      </div>
      <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 transition-colors focus-within:border-ring/60 focus-within:bg-secondary/60">
        <RiGlobeLine className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          inputMode="url"
          autoFocus
          placeholder="https://example.com"
          aria-label="Website URL"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2 text-[12px] font-semibold tracking-[-0.01em] text-foreground transition-colors",
          canSubmit
            ? "hover:bg-secondary/90 active:bg-secondary"
            : "cursor-not-allowed opacity-55"
        )}
      >
        <RiCameraLine className="size-3.5" />
        <span>Capture screenshot</span>
      </button>
    </form>
  )
}

function rotatedScreenContentStyle(
  aspectRatio: string,
  rotation: number
): React.CSSProperties | undefined {
  const ratio = parseAspectRatio(aspectRatio)
  if (!ratio)
    return { transform: `translate(-50%, -50%) rotate(${rotation}deg)` }

  return {
    width: `${100 / ratio}%`,
    height: `${ratio * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
  }
}

function parseAspectRatio(aspectRatio: string) {
  const [width, height] = aspectRatio
    .split("/")
    .map((part) => Number(part.trim()))
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return null
  }
  return width / height
}

function EditMenuItem({
  index,
  icon,
  label,
  hint,
  destructive,
  onClick,
}: {
  index: number
  icon: React.ReactNode
  label: string
  hint?: React.ReactNode
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: 0.04 + index * 0.045,
        type: "spring",
        stiffness: 420,
        damping: 30,
      }}
      whileHover={{ x: 2 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
        destructive
          ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
          : "text-foreground/85 hover:bg-accent hover:text-foreground"
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary/60">
        {icon}
      </span>
      <span className="flex flex-1 flex-col">
        <span>{label}</span>
        {hint && (
          <span className="text-[10px] leading-[1.2] text-muted-foreground/70 mt-0.5">
            {hint}
          </span>
        )}
      </span>
    </motion.button>
  )
}
