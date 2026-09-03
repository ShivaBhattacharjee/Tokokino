"use client"

import * as React from "react"
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiResetLeftLine,
} from "@remixicon/react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

export function MobileHistoryButton({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [resetAlertOpen, setResetAlertOpen] = React.useState(false)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const reset = useEditorStore((s) => s.reset)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="History"
            aria-pressed={open}
            className={cn(
              "flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors",
              open
                ? "border-primary bg-primary text-white"
                : "border-transparent text-foreground/60 hover:bg-[#cfe5b8]/20 hover:text-foreground dark:hover:bg-[#cfe5b8]/10"
            )}
          >
            <RiArrowGoBackLine className="size-5 shrink-0" />
            <span className="whitespace-nowrap">History</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          className="w-[min(198px,calc(100vw-2rem))] rounded-md border border-border/60 bg-popover/95 px-2.5 py-2 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-xl"
        >
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={() => {
                undo()
                onOpenChange(false)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-0.5 text-foreground transition-colors hover:bg-secondary/70 dark:hover:bg-white/5",
                !canUndo &&
                  "cursor-not-allowed text-foreground/35 hover:bg-transparent"
              )}
            >
              <RiArrowGoBackLine className="size-4.5" />
              <span className="text-[9px] font-medium">Undo</span>
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={() => {
                redo()
                onOpenChange(false)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-0.5 text-foreground transition-colors hover:bg-secondary/70 dark:hover:bg-white/5",
                !canRedo &&
                  "cursor-not-allowed text-foreground/35 hover:bg-transparent"
              )}
            >
              <RiArrowGoForwardLine className="size-4.5" />
              <span className="text-[9px] font-medium">Redo</span>
            </button>
            <button
              type="button"
              aria-label="Reset all"
              onClick={() => {
                onOpenChange(false)
                setResetAlertOpen(true)
              }}
              className="flex cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-0.5 text-foreground transition-colors hover:bg-secondary/70 dark:hover:bg-white/5"
            >
              <RiResetLeftLine className="size-4.5" />
              <span className="text-[9px] font-medium">Reset</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog open={resetAlertOpen} onOpenChange={setResetAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all your changes and restore the editor to its
              default state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                reset()
                setResetAlertOpen(false)
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
