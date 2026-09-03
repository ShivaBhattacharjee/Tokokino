"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiBrushLine,
  RiCheckboxBlankLine,
  RiCropLine,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiEqualizerLine,
  RiEraserLine,
  RiFileCopyLine,
  RiLayoutGrid2Line,
  RiMagicLine,
  RiMoonClearLine,
  RiPaletteLine,
  RiRotateLockLine,
  RiSunLine,
  RiZoomInLine,
} from "@remixicon/react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { AnimationClip, AnimationEffect } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { RAZOR_CURSOR as sharedRazorCursor } from "./timeline-clip-interactions"

export type ClipDragMode = "move" | "trim" | "trim-start"

export const RAZOR_CURSOR = sharedRazorCursor

type TimelineClipProps = {
  clip: AnimationClip
  left: number
  width: number
  selected: boolean
  /** How many clips a context-menu action will affect (this clip alone = 1, or
   * the whole selection when this clip is part of a multi-select). */
  selectedCount: number
  /** How many of the selected clips own effects — shown as "Remove effects (n)"
   * and gates the item when several clips are selected (a lone clip uses its own
   * `iconKeys` instead). */
  selectionEffectCount: number
  dragging: boolean
  interacting: boolean
  /** Clip sits past the set timeline duration — rendered faded + blurred. */
  beyond: boolean
  /**
   * Razor (cut) tool is active: the clip shows the scissor cursor, the trim
   * grips are disabled, and a pointer-down cuts instead of dragging (the cut is
   * handled upstream in onPointerDownClip).
   */
  razorMode: boolean
  /** Which inspector properties this clip animates — rendered as small icons. */
  iconKeys: ClipIconKey[]
  dupShortcut: string
  clearEffectsShortcut: string
  deselectShortcut: string
  onPointerDownClip: (e: React.PointerEvent, mode: ClipDragMode) => void
  onPointerMoveClip: (e: React.PointerEvent) => void
  onPointerUpClip: (e: React.PointerEvent) => void
  onDuplicate: () => void
  onClearEffects: () => void
  onDeselect: () => void
  onDelete: () => void
  onMenuOpenChange: (open: boolean) => void
}

const gripHandle =
  "absolute inset-y-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
const gripPill =
  "h-4 w-1 rounded-full bg-white/85 opacity-0 shadow transition-opacity duration-150 group-hover/clip:opacity-100"

const CLIP_GRADIENT =
  "linear-gradient(to bottom, color-mix(in oklab, var(--primary) 92%, white), color-mix(in oklab, var(--primary) 92%, black))"

// Which inspector properties a clip animates, surfaced as icons on the clip.
// The timeline clip's icon keys are exactly the animatable effects.
export type ClipIconKey = AnimationEffect

// Inspector-matching icons for the properties a clip animates.
const ICON_FOR: Record<ClipIconKey, typeof RiDragMove2Line> = {
  position: RiDragMove2Line,
  zoom: RiZoomInLine,
  tilt: RiRotateLockLine,
  padding: RiLayoutGrid2Line,
  shadow: RiMoonClearLine,
  backdrop: RiSunLine,
  background: RiPaletteLine,
  // Canvas Radius lives in the Backdrop section, so it shares its icon.
  canvasRadius: RiSunLine,
  // Lighting, Filter and Portrait all live in the Backdrop section — share the
  // sun icon, matching Backdrop and Canvas Radius.
  lighting: RiSunLine,
  filter: RiSunLine,
  portrait: RiSunLine,
  pattern: RiSunLine,
  ascii: RiSunLine,
  overlay: RiSunLine,
  // The media grade has its own Effects / Filters controls — share their icons.
  mediaEffects: RiEqualizerLine,
  mediaFilter: RiMagicLine,
  // Border lives in its own inspector section — share its brush icon.
  border: RiBrushLine,
  borderRadius: RiBrushLine,
  crop: RiCropLine,
}

const LABEL_FOR: Record<ClipIconKey, string> = {
  position: "Position",
  zoom: "Zoom",
  tilt: "Tilt",
  padding: "Padding",
  shadow: "Shadow",
  backdrop: "Backdrop",
  background: "Background",
  canvasRadius: "Canvas radius",
  lighting: "Lighting",
  filter: "Filter",
  portrait: "Portrait",
  pattern: "Pattern",
  ascii: "ASCII",
  overlay: "Overlay",
  mediaEffects: "Effects",
  mediaFilter: "Filters",
  border: "Border",
  borderRadius: "Radius",
  crop: "Crop",
}

export function TimelineClip({
  left,
  width,
  selected,
  selectedCount,
  selectionEffectCount,
  dragging,
  interacting,
  beyond,
  razorMode,
  iconKeys,
  dupShortcut,
  clearEffectsShortcut,
  deselectShortcut,
  onPointerDownClip,
  onPointerMoveClip,
  onPointerUpClip,
  onDuplicate,
  onClearEffects,
  onDeselect,
  onDelete,
  onMenuOpenChange,
}: TimelineClipProps) {
  // Several effects deliberately share an icon (border + border radius → brush;
  // backdrop / lighting / filter / portrait / pattern / overlay / canvas radius →
  // sun). Collapse to unique glyphs so a clip animating two of them doesn't show
  // the same icon twice.
  const uniqueIcons: (typeof RiDragMove2Line)[] = []
  for (const key of iconKeys) {
    const Icon = ICON_FOR[key]
    if (!uniqueIcons.includes(Icon)) uniqueIcons.push(Icon)
  }
  // Whether context-menu actions will hit several clips (a multi-select).
  const multi = selectedCount > 1
  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <motion.div
          onPointerDown={(e) => onPointerDownClip(e, "move")}
          onPointerMove={onPointerMoveClip}
          onPointerUp={onPointerUpClip}
          // Selection (and click-to-deselect) is handled in the pointer
          // down/up cycle; this just stops the click from reaching the track.
          onClick={(e) => e.stopPropagation()}
          style={{
            background: CLIP_GRADIENT,
            // Razor tool overrides the grab cursor with the scissor cursor.
            ...(razorMode ? { cursor: RAZOR_CURSOR } : null),
          }}
          className={cn(
            "group/clip absolute top-1 bottom-1 z-20 touch-none overflow-hidden rounded-sm transition-shadow duration-150 ease-out ring-inset",
            !razorMode && "cursor-grab active:cursor-grabbing",
            selected
              ? "ring-1 ring-white/60"
              : "ring-0 hover:ring-1 hover:ring-white/30",
            dragging && "z-30 ring-1 ring-white/40",
            // Past the set duration → desaturated to read as "beyond". The blur
            // is applied by the inactive-region overlay (which sits above the
            // clips) so a clip straddling the duration only blurs its overflow
            // portion, not the whole clip.
            beyond && "saturate-50"
          )}
          // Slide to new left/width when clips shift (e.g. duplicate ripples the
          // neighbours over). The clip you're actively dragging/trimming updates
          // instantly so it never lags behind the pointer. `left`/`width` start
          // at their real value in `initial` so a fresh clip pops in place (no
          // slide from 0) while only opacity/scale animate — that gives the
          // duplicated clip a visible fade+scale-in even when it lands in a gap
          // and no neighbours move.
          initial={{ opacity: 0, scale: 0.8, left, width }}
          animate={{
            left,
            width,
            y: dragging ? -3 : 0,
            opacity: beyond ? 0.5 : 1,
            scale: 1,
          }}
          // On delete, fade + shrink out while the neighbours slide in to fill.
          exit={{
            opacity: 0,
            scale: 0.8,
            transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
          }}
          transition={
            interacting
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }
          }
        >
          {/* One icon per animated property, then its name — dropped as the
              clip gets narrower. */}
          <div className="pointer-events-none flex h-full items-center gap-1.5 px-2.5">
            {uniqueIcons.length > 0 && width >= 44 && (
              <span className="flex shrink-0 items-center gap-1">
                {uniqueIcons.slice(0, 4).map((Icon, i) => (
                  <Icon key={i} className="size-3.5 shrink-0 text-white/90" />
                ))}
              </span>
            )}
            {iconKeys.length > 0 && width >= 110 && (
              <span className="truncate text-[11px] font-medium text-white/90">
                {LABEL_FOR[iconKeys[0]]}
                {iconKeys.length > 1 && ` +${iconKeys.length - 1}`}
              </span>
            )}
          </div>

          {/* Trim handles — a grip pill on each edge, revealed on hover. */}
          <div
            onPointerDown={(e) => onPointerDownClip(e, "trim-start")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(
              gripHandle,
              "left-0",
              // Razor tool disables trim so the whole clip is one cut surface.
              razorMode && "pointer-events-none"
            )}
          >
            <span className={cn(gripPill, razorMode && "hidden")} />
          </div>
          <div
            onPointerDown={(e) => onPointerDownClip(e, "trim")}
            onPointerMove={onPointerMoveClip}
            onPointerUp={onPointerUpClip}
            className={cn(
              gripHandle,
              "right-0",
              razorMode && "pointer-events-none"
            )}
          >
            <span className={cn(gripPill, razorMode && "hidden")} />
          </div>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onDuplicate}>
          <RiFileCopyLine />
          {multi ? `Duplicate ${selectedCount} clips` : "Duplicate"}
          <ContextMenuShortcut>{dupShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onClearEffects}
          // Alone → gate on this clip's own effects. In a multi-select, gate on
          // how many selected clips own effects (this clip may own none while
          // another does, or vice versa).
          disabled={multi ? selectionEffectCount === 0 : iconKeys.length === 0}
        >
          <RiEraserLine />
          {/* Count reflects clips that actually have effects, not the whole
              selection — clearing a clip with none is a no-op. */}
          {multi
            ? `Remove effects (${selectionEffectCount})`
            : "Remove effects"}
          <ContextMenuShortcut>{clearEffectsShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDeselect}>
          <RiCheckboxBlankLine />
          {multi ? "Deselect all" : "Deselect"}
          <ContextMenuShortcut>{deselectShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <RiDeleteBinLine />
          {multi ? `Delete ${selectedCount} clips` : "Delete"}
          <ContextMenuShortcut className="text-destructive/70">
            Del
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
