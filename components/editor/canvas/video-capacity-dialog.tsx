"use client"

import * as React from "react"
import { RiAlertLine } from "@remixicon/react"

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
import { formatBytes } from "@/components/editor/corner-progress"
import { useVideoCapacityPrompt } from "@/lib/editor/video-capacity"

export function VideoCapacityDialog() {
  const pending = useVideoCapacityPrompt((s) => s.pending)
  const resolvePending = useVideoCapacityPrompt((s) => s.resolvePending)
  const capacity = pending?.capacity ?? null

  const body = React.useMemo(() => {
    if (!capacity) return null
    const size = formatBytes(capacity.fileBytes)
    const free =
      capacity.freeBytes === null ? null : formatBytes(capacity.freeBytes)
    if (capacity.level === "over") {
      return {
        title: "This video won't fit in browser storage",
        description: free
          ? `The file is ${size} and this browser has about ${free} of storage left for Tokokino. You can still edit and export it — it plays straight from disk — but the draft won't be able to save it, so closing the tab loses the video.`
          : `The file is ${size}, which is larger than this browser is likely to store. You can still edit and export it — it plays straight from disk — but the draft won't be able to save it, so closing the tab loses the video.`,
        action: "Edit without saving",
      }
    }
    return {
      title: "Not much storage room left for this video",
      description: free
        ? `The file is ${size} and this browser has about ${free} left for Tokokino. It will save, but there won't be room to swap it for another video of the same size later, since the draft holds both copies while it writes.`
        : `The file is ${size}. It will edit and export fine, but this browser wouldn't report how much storage is available, so the draft may not be able to save it.`,
      action: "Import anyway",
    }
  }, [capacity])

  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) resolvePending(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{body?.title}</AlertDialogTitle>
          <AlertDialogDescription>{body?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-[12px] text-amber-200/80">
          <RiAlertLine className="size-4 shrink-0 text-amber-400" />
          <span>
            {capacity?.persisted
              ? "Export the result before you close the tab, or free up disk space and re-import."
              : "This browser hasn't granted Tokokino persistent storage, so it can clear saved drafts when the disk fills up. Export before you close the tab."}
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolvePending(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => resolvePending(true)}>
            {body?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
