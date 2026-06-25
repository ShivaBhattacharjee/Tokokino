"use client"

import { RiMagicLine } from "@remixicon/react"

import type { AssetFilter } from "@/lib/editor/state-types"

import { BackdropControlPopover } from "./control-popover"
import type { BackdropPickerLayout } from "./constants"
import { BackdropFilterGrid } from "./filter-grid"

export function FiltersControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  backdropFilter,
  pickerLayout,
  onOpenChange,
  onReset,
  setBackdropFilter,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  backdropFilter: AssetFilter
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setBackdropFilter: (filter: AssetFilter) => void
}) {
  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      inlineBodyMode="content"
      icon={RiMagicLine}
      label="Filters"
      active={backdropFilter !== "none"}
      title="Filters"
      description="Apply a colour grade to the background."
      onReset={onReset}
      resetTitle="Reset filter"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
    >
      <BackdropFilterGrid
        current={backdropFilter}
        onChange={setBackdropFilter}
        layout="grid"
        columns={pickerLayout === "carousel" ? 4 : 3}
      />
    </BackdropControlPopover>
  )
}
