"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type { BackdropLayerTarget } from "./constants"

const ITEM_CLASS =
  "h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"

/**
 * Picks which layer a colour adjustment lands on — the backdrop behind the
 * screenshot, or the screenshot/video pixels themselves. Both take the same
 * grade, so the controls are shared and only this switch changes where it goes.
 */
export function LayerTargetToggle({
  value,
  onChange,
}: {
  value: BackdropLayerTarget
  onChange: (value: BackdropLayerTarget) => void
}) {
  return (
    <div className="min-w-0 space-y-2">
      <span className="text-[11px] text-muted-foreground">Apply to</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as BackdropLayerTarget)}
        className="flex w-full rounded-md bg-secondary/60 p-1"
      >
        <ToggleGroupItem value="backdrop" className={ITEM_CLASS}>
          Backdrop
        </ToggleGroupItem>
        <ToggleGroupItem value="screenshot" className={ITEM_CLASS}>
          Screenshot
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
