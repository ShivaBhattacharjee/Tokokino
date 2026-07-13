"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiCheckboxBlankLine,
  RiClipboardLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiVolumeMuteLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"

import { RAZOR_CURSOR } from "./timeline-clip-interactions"

export type VideoTrimDragMode = "move" | "trim-start" | "trim-end"

type TimelineVideoClipProps = {
  left: number
  width: number
  selected: boolean
  trimming: boolean
  dragging: boolean
  razorMode: boolean
  muted: boolean
  children: React.ReactNode
  onPointerDownClip: (
    event: React.PointerEvent,
    mode?: VideoTrimDragMode
  ) => void
  onPointerMoveClip: (event: React.PointerEvent) => void
  onPointerUpClip: (event: React.PointerEvent) => void
  onDelete: () => void
  onDuplicate: () => void
  onCopy: () => void
  onToggleMute: () => void
  onDeselect: () => void
  onMenuOpenChange: (open: boolean) => void
}

const gripHandle =
  "absolute inset-y-0 z-20 flex w-3 cursor-ew-resize touch-none items-center justify-center"
const gripPill =
  "h-4 w-1 rounded-full bg-white/85 opacity-0 shadow transition-opacity duration-150 group-hover/video:opacity-100"

/** The editable video source range shown below the motion-keyframe row. */
export function TimelineVideoClip({
  left,
  width,
  selected,
  trimming,
  dragging,
  razorMode,
  muted,
  children,
  onPointerDownClip,
  onPointerMoveClip,
  onPointerUpClip,
  onDelete,
  onDuplicate,
  onCopy,
  onToggleMute,
  onDeselect,
  onMenuOpenChange,
}: TimelineVideoClipProps) {
  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <motion.div
          onPointerDown={(event) => onPointerDownClip(event, "move")}
          onPointerMove={onPointerMoveClip}
          onPointerUp={onPointerUpClip}
          onClick={(event) => event.stopPropagation()}
          style={razorMode ? { cursor: RAZOR_CURSOR } : undefined}
          className={cn(
            "group/video absolute top-0 bottom-0 touch-none overflow-hidden rounded-lg border bg-black/20",
            !razorMode && "cursor-grab active:cursor-grabbing",
            selected
              ? "border-primary ring-1 ring-primary/45"
              : "border-border/50 hover:border-foreground/35",
            trimming && "z-30"
          )}
          initial={{ opacity: 0, scale: 0.8, left, width }}
          animate={{
            opacity: dragging ? 0.72 : 1,
            scale: 1,
            left,
            width,
            y: dragging ? -3 : 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={
            trimming || dragging
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
          }
        >
          {children}
          <div
            onPointerDown={(event) => onPointerDownClip(event, "trim-start")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(
              gripHandle,
              "left-0",
              razorMode && "pointer-events-none"
            )}
          >
            <span className={gripPill} />
          </div>
          <div
            onPointerDown={(event) => onPointerDownClip(event, "trim-end")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(
              gripHandle,
              "right-0",
              razorMode && "pointer-events-none"
            )}
          >
            <span className={gripPill} />
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onDuplicate}>
          <RiFileCopyLine />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCopy}>
          <RiClipboardLine />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onSelect={onToggleMute}>
          {muted ? <RiVolumeUpLine /> : <RiVolumeMuteLine />}
          {muted ? "Unmute" : "Mute"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDeselect}>
          <RiCheckboxBlankLine />
          Deselect video clip
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <RiDeleteBinLine />
          Delete video clip
          <ContextMenuShortcut className="text-destructive/70">
            Del
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
