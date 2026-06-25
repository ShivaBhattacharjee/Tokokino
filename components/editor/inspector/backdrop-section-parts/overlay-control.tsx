"use client"

import { RiSunLine } from "@remixicon/react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Overlay } from "@/lib/editor/state-types"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import type { BackdropPickerLayout } from "./constants"
import { OverlayGrid } from "./overlay-grid"

export function OverlayControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  overlay,
  overlayIds,
  overlayActive,
  overlayPopoverOpen,
  overlayHasOpened,
  pickerLayout,
  onOpenChange,
  onReset,
  setOverlayPatch,
  setPreviewVar,
  clearPreviewVarAfterPaint,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  overlay: Overlay
  overlayIds: number[]
  overlayActive: boolean
  overlayPopoverOpen: boolean
  overlayHasOpened: boolean
  pickerLayout: BackdropPickerLayout
  onOpenChange: (open: boolean) => void
  onReset: () => void
  setOverlayPatch: (patch: Partial<Overlay>) => void
  setPreviewVar: (name: string, value: string | null) => void
  clearPreviewVarAfterPaint: (name: string) => void
}) {
  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      icon={RiSunLine}
      label="Overlay"
      active={overlayActive}
      title="Shadow Overlay"
      description="Drape a soft light or shadow texture over the canvas."
      onReset={onReset}
      resetTitle="Reset overlay"
      open={usesInlineControls ? inlineOpen : overlayPopoverOpen}
      onOpenChange={onOpenChange}
      forceMount={overlayHasOpened ? true : undefined}
      contentClassName="w-[240px] [contain:layout_paint] data-[state=closed]:pointer-events-none data-[state=closed]:invisible"
      bodyClassName="pr-1"
      footer={
        <div className="space-y-3">
          <div className="min-w-0">
            <EffectSlider
              label="Opacity"
              value={overlay.opacity}
              onChange={(v) => {
                setOverlayPatch({ opacity: v })
                clearPreviewVarAfterPaint("--bd-overlay-opacity")
              }}
              onPreview={(v) =>
                setPreviewVar("--bd-overlay-opacity", `${v / 100}`)
              }
            />
          </div>
          <div className="min-w-0 space-y-2">
            <span className="text-[11px] text-muted-foreground">Position</span>
            <ToggleGroup
              type="single"
              value={overlay.position}
              onValueChange={(v) =>
                v && setOverlayPatch({ position: v as "overlay" | "underlay" })
              }
              className="flex w-full rounded-md bg-secondary/60 p-1"
            >
              <ToggleGroupItem
                value="overlay"
                className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
              >
                Overlay
              </ToggleGroupItem>
              <ToggleGroupItem
                value="underlay"
                className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
              >
                Underlay
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      }
    >
      <OverlayGrid
        ids={overlayIds}
        selectedId={overlay.id}
        onSelect={(id) => setOverlayPatch({ id })}
        layout={pickerLayout}
      />
    </BackdropControlPopover>
  )
}
