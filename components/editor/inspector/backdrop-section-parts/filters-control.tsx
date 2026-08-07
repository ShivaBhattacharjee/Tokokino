"use client"

import { RiMagicLine } from "@remixicon/react"

import type { AssetFilter } from "@/lib/editor/state-types"

import { BackdropControlPopover } from "./control-popover"
import type { BackdropLayerTarget, BackdropPickerLayout } from "./constants"
import { BackdropFilterGrid } from "./filter-grid"
import { LayerTargetToggle } from "./layer-target-toggle"

export function FiltersControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  target,
  onTargetChange,
  mediaLabel,
  filter,
  pickerLayout,
  onOpenChange,
  onReset,
  setFilter,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  target: BackdropLayerTarget
  onTargetChange: (target: BackdropLayerTarget) => void
  /** "Video" or "Screenshot", depending on the media the filter lands on. */
  mediaLabel: string
  /** The filter of whichever layer the toggle points at. */
  filter: AssetFilter
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setFilter: (filter: AssetFilter) => void
}) {
  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      inlineBodyMode="content"
      icon={RiMagicLine}
      label="Filters"
      active={filter !== "none"}
      title="Filters"
      description={
        target === "backdrop"
          ? "Apply a colour grade to the background."
          : `Apply a colour grade to the ${mediaLabel.toLowerCase()}.`
      }
      onReset={onReset}
      resetTitle="Reset filter"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      footer={
        <LayerTargetToggle
          value={target}
          onChange={onTargetChange}
          mediaLabel={mediaLabel}
        />
      }
    >
      <BackdropFilterGrid
        current={filter}
        onChange={setFilter}
        layout="grid"
        columns={pickerLayout === "carousel" ? 4 : 3}
      />
    </BackdropControlPopover>
  )
}
