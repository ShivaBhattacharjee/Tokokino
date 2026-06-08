"use client"

import {
  RiAddLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiFullscreenLine,
  RiGalleryLine,
  RiSubtractLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { ToolbarPopover } from "@/components/editor/toolbar/primitives"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  MAX_SCREENSHOT_SLOTS,
  useEditor,
  useEditorStore,
} from "@/lib/editor/store"
import { editorValueSchemas } from "@/lib/editor/value-schemas"
import { cn } from "@/lib/utils"

import { FIT_OPTIONS } from "./options"

export function ScreenshotMediaPill() {
  const {
    addScreenshotSlot,
    screenshotSlots,
    updateScreenshotSlot,
    setSelectedScreenshotSlotId,
    setSelectedTextId,
    setSelectedAssetId,
    setSelectedAnnotationShapeId,
    setIsScreenshotSelected,
    setActiveTool,
    screenshot,
    tweet,
    objectFit,
    setObjectFit,
    frame,
    scale,
    setScale,
  } = useEditor()
  const presetTab = useEditorStore((s) => s.presetTab)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const selectedSlot = selectedScreenshotSlotId
    ? screenshotSlots.find((slot) => slot.id === selectedScreenshotSlotId)
    : null

  const fitHasScreenshot = selectedSlot
    ? Boolean(selectedSlot.src)
    : Boolean(screenshot)
  const currentFit = selectedSlot?.objectFit ?? objectFit ?? "cover"

  const isDisabled =
    presetTab === "multi" ||
    presetTab === "triple" ||
    Boolean(tweet) ||
    screenshotSlots.length >= MAX_SCREENSHOT_SLOTS

  const slotTooltip = isDisabled
    ? tweet
      ? "Disabled for social posts"
      : presetTab === "multi" || presetTab === "triple"
        ? `Disabled in ${presetTab === "triple" ? "Triple" : "Multi"} preset mode`
        : `Maximum ${MAX_SCREENSHOT_SLOTS} screenshot boxes`
    : "Add a screenshot slot"

  const hasDeviceFrame = frame.id !== "none"
  const hasScalableContent = selectedSlot
    ? true
    : Boolean(screenshot) || hasDeviceFrame || screenshotSlots.length > 0
  const activeScale = selectedSlot?.scale ?? scale

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md">
      {/* Undo / Redo — mobile + iPad only */}
      <span className="flex items-center xl:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent",
                !canUndo && "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              <RiArrowGoBackLine className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent",
                !canRedo && "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              <RiArrowGoForwardLine className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Redo</TooltipContent>
        </Tooltip>
        <span className="mx-1 h-5 w-px bg-border" />
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Add screenshot box"
            disabled={isDisabled}
            onClick={() => {
              const id = addScreenshotSlot()
              if (id) {
                setSelectedScreenshotSlotId(id)
                setSelectedTextId(null)
                setSelectedAssetId(null)
                setSelectedAnnotationShapeId(null)
                setIsScreenshotSelected(false)
                setActiveTool("pointer")
              } else {
                toast.error(
                  `Screenshot box limit reached (${MAX_SCREENSHOT_SLOTS})`
                )
              }
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RiGalleryLine className="size-4 shrink-0" />
            <span className="hidden sm:inline">Add Slot</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{slotTooltip}</TooltipContent>
      </Tooltip>

      {fitHasScreenshot ? (
        <ToolbarPopover
          tooltip="Image fit"
          contentClassName="w-56 p-2"
          trigger={({ open }) => (
            <button
              type="button"
              aria-label="Image fit"
              aria-pressed={open}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium whitespace-nowrap text-foreground/80 transition-colors hover:bg-accent",
                open && "bg-accent text-foreground"
              )}
            >
              <RiFullscreenLine className="size-4 shrink-0" />
              <span className="hidden sm:inline">Fill Mode</span>
            </button>
          )}
        >
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Fill Mode
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {FIT_OPTIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    if (selectedSlot) {
                      updateScreenshotSlot(selectedSlot.id, {
                        objectFit: value,
                      })
                    } else {
                      setObjectFit(value)
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-[11px] transition-all",
                    currentFit === value
                      ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                      : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  <span className="size-7">{icon}</span>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </ToolbarPopover>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              aria-label="Image fit"
              className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium whitespace-nowrap text-foreground/80 opacity-40"
            >
              <RiFullscreenLine className="size-4 shrink-0" />
              <span className="hidden sm:inline">Fill Mode</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Add a screenshot first</TooltipContent>
        </Tooltip>
      )}
      <span className="flex items-center md:hidden">
        <span className="mx-1 h-5 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={!hasScalableContent || activeScale <= 10}
              onClick={() => {
                const nextScale = editorValueSchemas.scale
                  .catch(100)
                  .parse(activeScale - 10)
                if (selectedSlot) {
                  updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
                  return
                }
                setScale(nextScale)
              }}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent",
                (!hasScalableContent || activeScale <= 10) &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              <RiSubtractLine className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasScalableContent
              ? "Zoom out"
              : "Add a screenshot or frame first"}
          </TooltipContent>
        </Tooltip>

        <button
          type="button"
          disabled={!hasScalableContent}
          onClick={() => {
            const resetScale = editorValueSchemas.scale.catch(100).parse(100)
            if (selectedSlot) {
              updateScreenshotSlot(selectedSlot.id, { scale: resetScale })
              return
            }
            setScale(resetScale)
          }}
          className={cn(
            "min-w-[3rem] cursor-pointer rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 tabular-nums hover:bg-accent",
            !hasScalableContent && "cursor-not-allowed opacity-40"
          )}
        >
          {activeScale}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={!hasScalableContent || activeScale >= 300}
              onClick={() => {
                const nextScale = editorValueSchemas.scale
                  .catch(100)
                  .parse(activeScale + 10)
                if (selectedSlot) {
                  updateScreenshotSlot(selectedSlot.id, { scale: nextScale })
                  return
                }
                setScale(nextScale)
              }}
              className={cn(
                "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent",
                (!hasScalableContent || activeScale >= 300) &&
                  "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              <RiAddLine className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasScalableContent ? "Zoom in" : "Add a screenshot or frame first"}
          </TooltipContent>
        </Tooltip>
      </span>
    </div>
  )
}
