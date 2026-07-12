"use client"

import * as React from "react"
import { RiInformationLine } from "@remixicon/react"

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

/**
 * Confirmation shown before a dropped/pasted/selected GIF is re-encoded to
 * WebM. GIFs are animated media, so we run them through the video pipeline
 * (play/pause/scrub + animated export) rather than a static <img> — but that
 * conversion is lossy and slow, so we ask first and nudge toward uploading a
 * real video format instead.
 */
export function GifTranscodeDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert GIF to video?</AlertDialogTitle>
          <AlertDialogDescription>
            GIFs are re-encoded to WebM so they play with the video controls
            (play, pause, scrub) and export as smooth animation. The conversion
            can take a moment and may slightly change quality.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-[12px] text-amber-200/80">
          <RiInformationLine className="size-4 shrink-0 text-amber-400" />
          <span>
            For the best quality and speed, upload an{" "}
            <span className="font-medium text-amber-100">MP4</span>,{" "}
            <span className="font-medium text-amber-100">WebM</span>, or other
            video file directly instead of a GIF.
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Convert &amp; import
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
