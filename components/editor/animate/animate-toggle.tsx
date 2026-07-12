"use client"

import { RiMagicLine } from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isVideoSrc } from "@/lib/editor/media-type"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

/**
 * The Animate pill itself (no positioning). Enters Animate mode on click, or
 * shows a "not available" tooltip while in bulk edit mode. The comet that rides
 * the border on hover is a masked gradient (see `.animate-beam` in globals.css).
 * Rendered by the floating {@link AnimateToggle} for still images, and inline in
 * the VideoControlBar (right of the Play bar) when the canvas is a video.
 */
export function AnimateTriggerButton({
  stretch = false,
}: {
  /** Fill the parent's height (used inline next to the Play bar so the two pills
   * line up). Requires the parent to give it a height, e.g. a stretched row. */
  stretch?: boolean
}) {
  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)

  const button = (
    <button
      type="button"
      aria-disabled={bulkEditMode || undefined}
      onClick={bulkEditMode ? undefined : () => setIsAnimateMode(true)}
      className={cn(
        "group pointer-events-auto relative overflow-hidden rounded-[10px] bg-foreground/15 p-[2px] shadow-lg transition-transform",
        stretch && "h-full",
        bulkEditMode
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer active:scale-95"
      )}
    >
      {/* A comet rides the border path at constant speed (see `.animate-beam`
          in globals.css). The button's own bg-foreground/15 shows as a subtle
          light/dark border underneath; the inner pill clips the comet to a
          thin travelling glow along the edge. Hidden until hover. */}
      <span
        aria-hidden
        className="animate-beam pointer-events-none absolute top-0 left-0 aspect-square w-14 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(to right,transparent,rgba(167,139,250,0.6) 45%,#22d3ee 75%,#ecfeff 100%)",
        }}
      />
      {/* Inner pill. When stretched, drop the vertical padding and fill height so
          it matches the Play bar rather than defining its own taller height. */}
      <span
        className={cn(
          "relative flex items-center gap-2 rounded-[8px] bg-popover/95 px-5 text-[13px] font-semibold text-foreground backdrop-blur-md",
          stretch ? "h-full py-0" : "py-2.5"
        )}
      >
        <RiMagicLine className="size-4 shrink-0" />
        Animate
      </span>
    </button>
  )

  if (!bulkEditMode) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">
        Not available in bulk edit mode
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Floating trigger that enters Animate mode. Hidden on phones (animate isn't
 * supported there); sits above the canvas on iPad widths and bottom-center on
 * desktop. When the active canvas is a video, the *desktop* trigger is rendered
 * inline inside the VideoControlBar (right of the Play bar) instead, so this
 * floating one is hidden at xl — but it stays at the top on iPad, where the
 * Play bar has no room for it.
 */
export function AnimateToggle() {
  const activeCanvasHasVideo = useEditorStore((s) =>
    isVideoSrc(
      s.present.canvases.find((c) => c.id === s.present.activeCanvasId)
        ?.screenshot ?? null
    )
  )

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 max-md:hidden xl:top-auto xl:bottom-18",
        activeCanvasHasVideo && "xl:hidden"
      )}
    >
      <AnimateTriggerButton />
    </div>
  )
}
