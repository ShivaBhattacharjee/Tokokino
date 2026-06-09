"use client"

import * as React from "react"
import {
  RiCheckLine,
  RiCropLine,
  RiDeleteBinLine,
  RiPencilLine,
} from "@remixicon/react"
import { Select as SelectPrimitive } from "radix-ui"

import {
  UploadCard,
  type CaptureDevice,
  type CaptureSettings,
} from "@/components/editor/canvas/upload-card"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import { ScrollFadeBody } from "@/components/editor/scroll-fade"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BROWSER_FRAMES,
  getBrowserFrame,
  resolveBrowserFrameColor,
} from "@/lib/browser-frame"
import type { DeviceFrame, FrameOrientation } from "@/lib/editor/store"
import { DEVICE_MOCKUPS, getDeviceMockup } from "@/lib/mockups"
import { cn } from "@/lib/utils"

type ScreenshotEditMenuProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCrop: () => void
  onReplaceFile: (file: File) => void
  onDelete: () => void
  showDelete?: boolean
  onCaptureWebsite?: (
    url: string,
    settings: CaptureSettings
  ) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  captureDefaultDevice?: CaptureDevice
  captureDefaultOrientation?: "vertical" | "horizontal"
  captureStateKey?: string
}

export function ScreenshotEditMenu({
  open,
  onOpenChange,
  onCrop,
  onReplaceFile,
  onDelete,
  showDelete = true,
  onCaptureWebsite,
  onLoadTweet,
  captureDefaultDevice,
  captureDefaultOrientation,
  captureStateKey,
}: ScreenshotEditMenuProps) {
  const replaceInputRef = React.useRef<HTMLInputElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const fallbackCaptureStateKey = React.useId()
  const resolvedCaptureStateKey = captureStateKey ?? fallbackCaptureStateKey

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }

  return (
    <>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            onReplaceFile(file)
            handleOpenChange(false)
          }
          e.target.value = ""
        }}
      />
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <button
            ref={triggerRef}
            data-export-hidden="true"
            type="button"
            aria-label="Edit screenshot"
            title="Edit screenshot"
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              handleOpenChange(!open)
            }}
            // Counter-scale by the canvas's autoFit so the pencil keeps a
            // consistent on-screen size whether the canvas is landscape
            // (autoFit ≈ 1) or tall portrait (autoFit ≈ 0.3).
            style={{
              transform:
                "scale(clamp(1, calc(1 / var(--canvas-fit-scale, 1)), 1.8))",
              transformOrigin: "center",
            }}
            className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background text-foreground shadow-xl ring-2 ring-foreground/15 transition-[ring-color] hover:ring-foreground/30 sm:size-14"
          >
            <RiPencilLine className="size-5 sm:size-7" />
          </button>
        </PopoverAnchor>
        <PopoverContent
          data-export-hidden="true"
          align="center"
          side="bottom"
          sideOffset={10}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onInteractOutside={(e) => {
            const target = e.target
            if (
              target instanceof Node &&
              triggerRef.current?.contains(target)
            ) {
              e.preventDefault()
            }
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="screenshot-edit-popover w-[320px] gap-0 rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl data-closed:animate-none"
        >
          <div className="overflow-hidden rounded-2xl">
            <UploadCard
              onBrowse={() => replaceInputRef.current?.click()}
              defaultDevice={captureDefaultDevice}
              defaultOrientation={captureDefaultOrientation}
              captureStateKey={resolvedCaptureStateKey}
              onCapture={onCaptureWebsite}
              onLoadTweet={onLoadTweet}
            />
            <div
              className={cn(
                "grid gap-2 border-t border-border/60 p-2.5",
                showDelete ? "grid-cols-2" : "grid-cols-1"
              )}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenChange(false)
                  onCrop()
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground/[0.06] text-[13px] font-medium text-foreground/75 transition-all hover:bg-foreground/10 hover:text-foreground"
              >
                <RiCropLine className="size-4" />
                Crop
              </button>
              {showDelete ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenChange(false)
                    onDelete()
                  }}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive/10 text-[13px] font-medium text-destructive transition-all hover:bg-destructive/18 hover:text-destructive"
                >
                  <RiDeleteBinLine className="size-4" />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

export function ScreenshotFrameSettings({
  frame,
  onFrameChange,
}: {
  frame: DeviceFrame
  onFrameChange: (frame: DeviceFrame) => void
}) {
  const currentDevice = getDeviceMockup(frame.id)
  const currentBrowserFrame = getBrowserFrame(frame.id)
  const deviceOptions = React.useMemo(
    () => [
      { id: "none", name: "None" },
      ...BROWSER_FRAMES.map((browserFrame) => ({
        id: browserFrame.id,
        name: browserFrame.name,
      })),
      ...DEVICE_MOCKUPS.filter(
        (device) =>
          device.id.startsWith("iphone") ||
          device.id.startsWith("pixel") ||
          device.id.startsWith("galaxy") ||
          device.id.startsWith("nothing") ||
          device.id.startsWith("ipad")
      ).map((device) => ({ id: device.id, name: device.name })),
    ],
    []
  )
  const availableColors = currentDevice
    ? [...currentDevice.colors]
    : currentBrowserFrame
      ? [...currentBrowserFrame.colors]
      : []
  const availableOrientations = currentDevice?.orientations ?? []
  const isCurrentBrowserFrame = Boolean(currentBrowserFrame)
  const frameOrientationSupported = currentDevice
    ? frame.orientation === "vertical"
      ? availableOrientations.includes("portrait")
      : availableOrientations.includes("landscape")
    : true
  const effectiveColor = currentBrowserFrame
    ? resolveBrowserFrameColor(frame.color)
    : currentDevice && availableColors.includes(frame.color)
      ? frame.color
      : (availableColors[0] ?? frame.color)
  const effectiveOrientation = isCurrentBrowserFrame
    ? "horizontal"
    : currentDevice && frameOrientationSupported
      ? frame.orientation
      : availableOrientations[0] === "landscape"
        ? "horizontal"
        : "vertical"

  const updateDevice = (id: string) => {
    if (id === "none") {
      onFrameChange({ id: "none", color: "black", orientation: "vertical" })
      return
    }
    const nextBrowserFrame = getBrowserFrame(id)
    if (nextBrowserFrame) {
      onFrameChange({
        id,
        color: nextBrowserFrame.colors.includes(
          resolveBrowserFrameColor(frame.color)
        )
          ? resolveBrowserFrameColor(frame.color)
          : nextBrowserFrame.colors[0],
        orientation: "horizontal",
      })
      return
    }
    const nextDevice = getDeviceMockup(id)
    const nextOrientation = nextDevice?.orientations.includes("portrait")
      ? "vertical"
      : "horizontal"
    onFrameChange({
      id,
      color: nextDevice?.colors[0] ?? "black",
      orientation: nextOrientation,
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-1 pt-1">
        <span className="text-[12px] font-medium tracking-[-0.01em] text-foreground">
          Screenshot frame
        </span>
      </div>

      <div className="space-y-1.5">
        <span className="px-1 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Frame
        </span>
        <Select value={frame.id} onValueChange={updateDevice}>
          <SelectTrigger
            className="h-8 w-full justify-between bg-secondary/40 text-[12px]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <FrameSelectContent>
            {deviceOptions.map((device) => (
              <FrameSelectItem key={device.id} value={device.id}>
                {device.name}
              </FrameSelectItem>
            ))}
          </FrameSelectContent>
        </Select>
      </div>

      {currentDevice || currentBrowserFrame ? (
        <>
          <div className="space-y-1.5">
            <span className="px-1 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Color
            </span>
            <Select
              value={effectiveColor}
              onValueChange={(color) =>
                onFrameChange({
                  ...frame,
                  color,
                  orientation: effectiveOrientation,
                })
              }
            >
              <SelectTrigger
                className="h-8 w-full justify-between bg-secondary/40 text-[12px]"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1200]">
                {availableColors.map((color) => (
                  <SelectItem key={color} value={color}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-3.5 rounded-full border border-black/10 shadow-sm"
                        style={colorSwatchStyle(color)}
                      />
                      <span>{formatFrameLabel(color)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentDevice ? (
            <div className="space-y-1.5">
              <span className="px-1 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Orientation
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/40 p-1">
                {(["vertical", "horizontal"] as const).map((orientation) => {
                  const supported =
                    orientation === "vertical"
                      ? availableOrientations.includes("portrait")
                      : availableOrientations.includes("landscape")
                  const active = effectiveOrientation === orientation
                  return (
                    <button
                      key={orientation}
                      type="button"
                      disabled={!supported}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onFrameChange({
                          ...frame,
                          color: effectiveColor,
                          orientation,
                        })
                      }}
                      className={cn(
                        "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background/60",
                        !supported && "cursor-not-allowed opacity-35"
                      )}
                    >
                      <OrientGlyph orientation={orientation} active={active} />
                      <span>{formatFrameLabel(orientation)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function FrameSelectContent({ children }: { children: React.ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className="relative z-[1200] max-h-[240px] min-w-32 origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        position="item-aligned"
      >
        <ScrollFadeBody
          rootClassName="max-h-[240px]"
          className="max-h-[240px]"
          fadeClassName="from-popover"
        >
          <SelectPrimitive.Viewport>
            <div className="p-1">{children}</div>
          </SelectPrimitive.Viewport>
        </ScrollFadeBody>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function FrameSelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <RiCheckLine className="pointer-events-none size-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function OrientGlyph({
  orientation,
  active,
}: {
  orientation: FrameOrientation
  active?: boolean
}) {
  return (
    <span aria-hidden className="flex size-4 items-center justify-center">
      <span
        className={cn(
          "h-3.5 w-2 rounded-[2px] transition-transform",
          active ? "bg-foreground" : "bg-foreground/50",
          orientation === "horizontal" && "rotate-90"
        )}
      />
    </span>
  )
}

function formatFrameLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

function colorSwatchStyle(color: string): React.CSSProperties {
  const colors: Record<string, string> = {
    black: "#111111",
    blue: "#8fc5e8",
    cosmic_orange: "#ff8a3d",
    dark: "#2b2b2b",
    dark_green: "#264133",
    deep_blue: "#1d314d",
    gray: "#8a8a86",
    grey: "#777b82",
    hazel: "#6e7463",
    lavender: "#c9b7df",
    light: "#f4f4f4",
    light_blush: "#efc7c5",
    midnight: "#202637",
    mist_blue: "#bdd4e8",
    natural: "#b7aaa0",
    navy: "#182740",
    obsidian: "#1b1b1d",
    sage: "#a6b9a1",
    silver: "#d6d6d2",
    snow: "#f1f0ea",
    space_gray: "#72716d",
    starlight: "#eee4d6",
    white: "#f7f7f4",
  }

  return {
    background:
      colors[color] ??
      "linear-gradient(135deg, #2d2d2d 0 25%, #525252 25% 50%, #2d2d2d 50% 75%, #525252 75%)",
  }
}
