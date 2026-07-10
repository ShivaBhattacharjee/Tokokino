"use client"

import { RiMagicLine } from "@remixicon/react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

/**
 * Floating trigger that enters Animate mode. Hidden on phones (animate isn't
 * supported there); sits above the canvas on iPad widths and bottom-center on
 * desktop. The animated rainbow border is a masked conic-gradient ring (see the
 * `animate-spin` gradient below), themed with a subtle dark inner pill to match
 * the editor.
 */
export function AnimateToggle() {
  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)

  const button = (
    <button
      type="button"
      aria-disabled={bulkEditMode || undefined}
      onClick={bulkEditMode ? undefined : () => setIsAnimateMode(true)}
      className={cn(
        "group pointer-events-auto relative overflow-hidden rounded-[10px] bg-foreground/15 p-[2px] shadow-lg transition-transform",
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
      {/* Inner pill */}
      <span className="relative flex items-center gap-2 rounded-[8px] bg-popover/95 px-5 py-2.5 text-[13px] font-semibold text-foreground backdrop-blur-md">
        <RiMagicLine className="size-4" />
        Animate
      </span>
    </button>
  )

  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 max-md:hidden xl:top-auto xl:bottom-20">
      {bulkEditMode ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="top">
            Not available in bulk edit mode
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </div>
  )
}
