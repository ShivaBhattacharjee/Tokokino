"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiCropLine,
  RiDeleteBinLine,
  RiGlobeLine,
  RiPencilLine,
  RiRefreshLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type {
  EditorTool,
  ScreenshotLayer,
} from "@/lib/editor/store"
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
  onCropClick: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  onCaptureWebsiteClick?: () => void
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
  onCropClick,
  onReplaceFile,
  onDelete,
  onCaptureWebsiteClick,
}: ScreenshotMockupProps) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = React.useState(false)
  // For device frames the shadow must follow the alpha silhouette of the
  // frame PNG (rounded corners, notch, etc). drop-shadow filters do that;
  // box-shadow would cast a rectangular shadow off the bounding box.
  const combinedFilter =
    [shadowFilter, enhanceFilter].filter(Boolean).join(" ") || undefined
  return (
    <div
      className="group/mockup pointer-events-none flex h-full w-full items-center justify-center"
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
            <Popover open={editOpen} onOpenChange={setEditOpen}>
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
                className="w-44 rounded-xl border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-md"
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
                >
                  <EditMenuItem
                    index={0}
                    icon={<RiCropLine className="size-4" />}
                    label="Crop"
                    onClick={() => {
                      setEditOpen(false)
                      onCropClick()
                    }}
                  />
                  <EditMenuItem
                    index={1}
                    icon={<RiRefreshLine className="size-4" />}
                    label="Replace"
                    onClick={() => {
                      setEditOpen(false)
                      replaceInputRef.current?.click()
                    }}
                  />
                  {onCaptureWebsiteClick ? (
                    <EditMenuItem
                      index={2}
                      icon={<RiGlobeLine className="size-4" />}
                      label="Capture website"
                      onClick={() => {
                        setEditOpen(false)
                        onCaptureWebsiteClick()
                      }}
                    />
                  ) : null}
                  <EditMenuItem
                    index={onCaptureWebsiteClick ? 3 : 2}
                    icon={<RiDeleteBinLine className="size-4" />}
                    label="Delete"
                    destructive
                    onClick={() => {
                      setEditOpen(false)
                      onDelete()
                    }}
                  />
                </motion.div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EditMenuItem({
  index,
  icon,
  label,
  destructive,
  onClick,
}: {
  index: number
  icon: React.ReactNode
  label: string
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
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
        destructive
          ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
          : "text-foreground/85 hover:bg-accent hover:text-foreground"
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary/60">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </motion.button>
  )
}
