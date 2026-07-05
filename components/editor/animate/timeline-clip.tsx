"use client"

import * as React from "react"
import { motion } from "motion/react"
import { RiDeleteBinLine, RiFileCopyLine } from "@remixicon/react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { AnimationClip } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

export type ClipDragMode = "move" | "trim" | "trim-start"

type TimelineClipProps = {
  clip: AnimationClip
  left: number
  width: number
  selected: boolean
  dragging: boolean
  interacting: boolean
  screenshot: string | null
  dupShortcut: string
  onPointerDownClip: (e: React.PointerEvent, mode: ClipDragMode) => void
  onPointerMoveClip: (e: React.PointerEvent) => void
  onPointerUpClip: (e: React.PointerEvent) => void
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMenuOpenChange: (open: boolean) => void
}

const gripHandle =
  "absolute inset-y-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
const gripPill =
  "h-4 w-1 rounded-full bg-foreground/50 opacity-0 shadow transition-opacity duration-150 group-hover/clip:opacity-100"

export function TimelineClip({
  clip,
  left,
  width,
  selected,
  dragging,
  interacting,
  screenshot,
  dupShortcut,
  onPointerDownClip,
  onPointerMoveClip,
  onPointerUpClip,
  onSelect,
  onDuplicate,
  onDelete,
  onMenuOpenChange,
}: TimelineClipProps) {
  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <motion.div
          onPointerDown={(e) => onPointerDownClip(e, "move")}
          onPointerMove={onPointerMoveClip}
          onPointerUp={onPointerUpClip}
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className={cn(
            "group/clip absolute top-1 bottom-1 z-20 cursor-grab touch-none overflow-hidden rounded-md border bg-linear-to-b from-neutral-100 to-neutral-200 transition-[border-color] duration-150 ease-out active:cursor-grabbing dark:from-neutral-700/70 dark:to-neutral-800",
            selected
              ? "border-primary/60"
              : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20",
            dragging && "z-30 border-foreground/25"
          )}
          // Slide to new left/width when clips shift (e.g. duplicate ripples the
          // neighbours over). The clip you're actively dragging/trimming updates
          // instantly so it never lags behind the pointer.
          initial={false}
          animate={{ left, width, y: dragging ? -3 : 0 }}
          transition={
            interacting
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
          }
        >
          {/* Centered mockup preview — the thing being animated. */}
          <div className="pointer-events-none flex h-full items-center justify-center px-3">
            {screenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={screenshot}
                alt=""
                className="h-7 max-w-[64px] rounded-[5px] object-cover ring-1 ring-foreground/10"
              />
            ) : (
              <span className="h-7 w-12 rounded-[5px] bg-foreground/10 ring-1 ring-foreground/10" />
            )}
          </div>

          {/* Trim handles — a grip pill on each edge, revealed on hover. */}
          <div
            onPointerDown={(e) => onPointerDownClip(e, "trim-start")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(gripHandle, "left-0")}
          >
            <span className={gripPill} />
          </div>
          <div
            onPointerDown={(e) => onPointerDownClip(e, "trim")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(gripHandle, "right-0")}
          >
            <span className={gripPill} />
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={onDuplicate}>
          <RiFileCopyLine />
          Duplicate
          <ContextMenuShortcut>{dupShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <RiDeleteBinLine />
          Delete
          <ContextMenuShortcut className="text-destructive/70">
            Del
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
