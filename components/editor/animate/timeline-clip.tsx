"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  RiBrushLine,
  RiCheckboxBlankLine,
  RiDeleteBinLine,
  RiDragMove2Line,
  RiEraserLine,
  RiFileCopyLine,
  RiLayoutGrid2Line,
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

export type ClipDragMode = "move" | "trim" | "trim-start"

// Custom scissor cursor for the razor/cut tool. A white-outlined black scissors
// (Feather "scissors") so it reads on both light and dark clips; the hotspot
// sits at the blade pivot so the cut lands under the visible crossing point.
const SCISSOR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'>" +
  "<g stroke='white' stroke-width='4'><circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><line x1='20' y1='4' x2='8.12' y2='15.88'/><line x1='14.47' y1='14.48' x2='20' y2='20'/><line x1='8.12' y1='8.12' x2='12' y2='12'/></g>" +
  "<g stroke='black' stroke-width='2'><circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><line x1='20' y1='4' x2='8.12' y2='15.88'/><line x1='14.47' y1='14.48' x2='20' y2='20'/><line x1='8.12' y1='8.12' x2='12' y2='12'/></g>" +
  "</svg>"
export const RAZOR_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  SCISSOR_SVG
)}") 8 12, crosshair`

type TimelineClipProps = {
  clip: AnimationClip
  left: number
  width: number
  selected: boolean
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
  /**
   * Thumbnail(s) of the screenshot(s) this clip animates. One image renders as a
   * single preview; multiple (an "all" clip) render as a small grid.
   */
  images: string[]
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
  "h-4 w-1 rounded-full bg-foreground/50 opacity-0 shadow transition-opacity duration-150 group-hover/clip:opacity-100"

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
  overlay: RiSunLine,
  // Border lives in its own inspector section — share its brush icon.
  border: RiBrushLine,
  borderRadius: RiBrushLine,
}

export function TimelineClip({
  left,
  width,
  selected,
  dragging,
  interacting,
  beyond,
  razorMode,
  images,
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
          // Razor tool overrides the grab cursor with the scissor cursor.
          style={razorMode ? { cursor: RAZOR_CURSOR } : undefined}
          className={cn(
            "group/clip absolute top-1 bottom-1 z-20 touch-none overflow-hidden rounded-md border bg-linear-to-b from-neutral-100 to-neutral-200 transition-[border-color] duration-150 ease-out dark:from-neutral-700/70 dark:to-neutral-800",
            !razorMode && "cursor-grab active:cursor-grabbing",
            selected
              ? "border-primary/60"
              : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20",
            dragging && "z-30 border-foreground/25",
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
          {/* Centered mockup preview — the screenshot(s) this clip animates.
              A single target shows one thumbnail; an "all" clip shows every
              image as a compact grid so it reads as spanning all of them. */}
          <div className="pointer-events-none flex h-full items-center justify-center px-3">
            {images.length === 0 ? (
              <span className="h-7 w-12 rounded-[5px] bg-foreground/10 ring-1 ring-foreground/10" />
            ) : images.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0]}
                alt=""
                className="h-7 max-w-[64px] rounded-[5px] object-cover ring-1 ring-foreground/10"
              />
            ) : (
              // Up to 4 thumbnails in a 2-col grid; a "+N" chip if there are more.
              <div className="grid max-w-[68px] grid-cols-2 gap-[2px]">
                {images.slice(0, 4).map((src, i) => (
                  <div
                    key={i}
                    className="relative h-3.5 w-[22px] overflow-hidden rounded-[3px] ring-1 ring-foreground/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {i === 3 && images.length > 4 && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[9px] font-semibold text-white">
                        +{images.length - 3}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Animated-property icons (position / zoom / tilt) — mirrors the
              inspector's section icons so the clip shows what it animates. Plain
              muted glyphs, no chrome; only shown when the clip is wide enough. */}
          {uniqueIcons.length > 0 && width >= 78 && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex max-w-[70%] items-center justify-end gap-1 overflow-hidden">
              {uniqueIcons.map((Icon, i) => (
                <Icon
                  key={i}
                  className="size-3 shrink-0 text-foreground/55 dark:text-foreground/60"
                />
              ))}
            </div>
          )}

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
          Duplicate
          <ContextMenuShortcut>{dupShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onClearEffects}
          disabled={iconKeys.length === 0}
        >
          <RiEraserLine />
          Remove effects
          <ContextMenuShortcut>{clearEffectsShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDeselect}>
          <RiCheckboxBlankLine />
          Deselect
          <ContextMenuShortcut>{deselectShortcut}</ContextMenuShortcut>
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
