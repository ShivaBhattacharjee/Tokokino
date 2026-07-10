"use client"

import * as React from "react"
import { RiBookmarkLine, RiDraftLine, RiSaveLine } from "@remixicon/react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import type { CurrentDraftInfo } from "@/lib/editor/store"
import { SaveActionRow } from "./ui"

function saveCopy(
  isAnimateMode: boolean,
  currentDraft: CurrentDraftInfo | null
) {
  if (isAnimateMode) {
    return {
      headerDescription: currentDraft
        ? `Currently editing "${currentDraft.name}" (with animation).`
        : "Save this animation as a reusable preset or project.",
      presetTitle: "Save as animate preset",
      presetDescription: "Reuse this timeline and look for new projects.",
      draftTitle: currentDraft ? "Save animate draft" : "Save as animate draft",
      draftDescription: currentDraft
        ? "Update this project and timeline so you can resume later."
        : "Save the project and timeline so you can resume editing later.",
      tooltip: "Save animation",
    }
  }
  return {
    headerDescription: currentDraft
      ? `Currently editing "${currentDraft.name}".`
      : "Save the current layout or the entire project.",
    presetTitle: "Save as preset",
    presetDescription: "Reuse this layout for new projects.",
    draftTitle: currentDraft ? "Save draft" : "Save as draft",
    draftDescription: currentDraft
      ? "Update this project so you can resume later."
      : "Save the project so you can resume editing later.",
    tooltip: "Save project",
  }
}

export function SaveControls({
  open,
  currentDraft,
  isDraftSaving,
  isAnimateMode = false,
  onOpenChange,
  onSaveAsPreset,
  onSaveAsDraft,
}: {
  open: boolean
  currentDraft: CurrentDraftInfo | null
  isDraftSaving: boolean
  isAnimateMode?: boolean
  onOpenChange: (open: boolean) => void
  onSaveAsPreset: () => void
  onSaveAsDraft: () => void
}) {
  const copy = saveCopy(isAnimateMode, currentDraft)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="lg">
              <RiSaveLine />
              <span className="hidden xl:inline">Save</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{copy.tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),320px)] gap-2 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-md data-open:zoom-in-95 data-closed:zoom-out-95"
      >
        <div className="px-1 pt-1 pb-2">
          <p className="text-sm font-medium">Save</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {copy.headerDescription}
          </p>
        </div>
        <SaveActionRow
          icon={RiBookmarkLine}
          title={copy.presetTitle}
          description={copy.presetDescription}
          onClick={onSaveAsPreset}
        />
        <SaveActionRow
          icon={RiDraftLine}
          title={copy.draftTitle}
          description={copy.draftDescription}
          loading={isDraftSaving}
          onClick={onSaveAsDraft}
        />
      </PopoverContent>
    </Popover>
  )
}

export function MobileSaveDialog({
  open,
  currentDraft,
  isDraftSaving,
  isAnimateMode = false,
  onOpenChange,
  onSaveAsPreset,
  onSaveAsDraft,
}: {
  open: boolean
  currentDraft: CurrentDraftInfo | null
  isDraftSaving: boolean
  isAnimateMode?: boolean
  onOpenChange: (open: boolean) => void
  onSaveAsPreset: () => void
  onSaveAsDraft: () => void
}) {
  const copy = saveCopy(isAnimateMode, currentDraft)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100vw-2rem),360px)] gap-2 rounded-2xl p-3 md:hidden">
        <DialogHeader className="px-1 pb-1 text-left">
          <DialogTitle>Save</DialogTitle>
          <DialogDescription>{copy.headerDescription}</DialogDescription>
        </DialogHeader>
        <SaveActionRow
          icon={RiBookmarkLine}
          title={copy.presetTitle}
          description={copy.presetDescription}
          onClick={onSaveAsPreset}
        />
        <SaveActionRow
          icon={RiDraftLine}
          title={copy.draftTitle}
          description={copy.draftDescription}
          loading={isDraftSaving}
          onClick={onSaveAsDraft}
        />
      </DialogContent>
    </Dialog>
  )
}
