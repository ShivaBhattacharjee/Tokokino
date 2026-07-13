"use client"

import * as React from "react"
import {
  RiBookmarkLine,
  RiDiceLine,
  RiFileAddLine,
  RiSaveLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { randomDisplayName } from "@/lib/random-name"
import { truncateChoiceDialogName } from "./types"
import { SaveActionRow } from "./ui"

export function DraftChoiceDialog({
  open,
  onOpenChange,
  draftName,
  isSaving,
  isAnimateMode = false,
  onUpdateExisting,
  onCreateNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draftName: string
  isSaving: boolean
  isAnimateMode?: boolean
  onUpdateExisting: () => Promise<void>
  onCreateNew: () => void
}) {
  const displayDraftName = truncateChoiceDialogName(draftName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isAnimateMode ? "Save animate draft" : "Save draft"}
          </DialogTitle>
          <DialogDescription>
            You&apos;re editing &ldquo;{displayDraftName}&rdquo;. Update it or
            save as a new draft
            {isAnimateMode ? " (includes the timeline)." : "."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <SaveActionRow
            icon={RiSaveLine}
            title={
              isAnimateMode
                ? "Update existing animate draft"
                : "Update existing draft"
            }
            description={`Overwrite "${displayDraftName}" with your current changes.`}
            loading={isSaving}
            onClick={() => void onUpdateExisting()}
          />
          <SaveActionRow
            icon={RiFileAddLine}
            title={
              isAnimateMode ? "Save as new animate draft" : "Save as new draft"
            }
            description="Keep the original and create a separate copy."
            onClick={onCreateNew}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PresetChoiceDialog({
  open,
  onOpenChange,
  presetName,
  isSaving,
  isAnimateMode = false,
  onUpdateExisting,
  onCreateNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetName: string
  isSaving: boolean
  isAnimateMode?: boolean
  onUpdateExisting: () => Promise<void>
  onCreateNew: () => void
}) {
  const displayPresetName = truncateChoiceDialogName(presetName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {isAnimateMode ? "Save animate preset" : "Save preset"}
          </DialogTitle>
          <DialogDescription>
            You&apos;re editing &ldquo;{displayPresetName}&rdquo;. Update it or
            save as a new {isAnimateMode ? "animate " : ""}preset.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <SaveActionRow
            icon={RiBookmarkLine}
            title={
              isAnimateMode
                ? "Update existing animate preset"
                : "Update existing preset"
            }
            description={
              isAnimateMode
                ? `Overwrite "${displayPresetName}" with the current timeline and look.`
                : `Overwrite "${displayPresetName}" with the current layout.`
            }
            loading={isSaving}
            onClick={() => void onUpdateExisting()}
          />
          <SaveActionRow
            icon={RiFileAddLine}
            title={
              isAnimateMode
                ? "Save as new animate preset"
                : "Save as new preset"
            }
            description="Keep the original and create a separate preset."
            onClick={onCreateNew}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  uploadProgress,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  loading: boolean
  uploadProgress?: { current: number; total: number } | null
  onConfirm: (name: string) => void | Promise<void>
}) {
  const [name, setName] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(randomDisplayName())
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [open])

  const rollName = React.useCallback(() => {
    setName(randomDisplayName())
    inputRef.current?.focus()
  }, [])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && !loading
  const percent = uploadProgress
    ? Math.round(
        (uploadProgress.current / Math.max(1, uploadProgress.total)) * 100
      )
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-stretch gap-2">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault()
                  void onConfirm(trimmed)
                }
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={rollName}
                  aria-label="Pick a random name"
                >
                  <RiDiceLine />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Random name</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {percent !== null ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Uploading video — {percent}%</span>
              <span>
                {Math.round(uploadProgress!.current / 1024 / 1024)} /{" "}
                {Math.round(uploadProgress!.total / 1024 / 1024)} MB
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={() => void onConfirm(trimmed)}
            disabled={!canSubmit}
          >
            {loading ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
