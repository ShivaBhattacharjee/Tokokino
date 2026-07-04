"use client"

import { RiMagicLine } from "@remixicon/react"

import { useActiveCanvasField, useEditorStore } from "@/lib/editor/store"

/**
 * Floating, bottom-center trigger that enters Animate mode. The animated
 * rainbow border is a masked conic-gradient ring (see the `animate-spin`
 * gradient below), themed with a subtle dark inner pill to match the editor.
 */
export function AnimateToggle() {
  const setIsAnimateMode = useEditorStore((s) => s.setIsAnimateMode)
  const hasScreenshot = useActiveCanvasField((c) => Boolean(c.screenshot))

  if (!hasScreenshot) return null

  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 max-md:bottom-[210px]">
      <button
        type="button"
        onClick={() => setIsAnimateMode(true)}
        className="group pointer-events-auto relative cursor-pointer overflow-hidden rounded-[10px] bg-foreground/15 p-[2px] shadow-lg transition-transform active:scale-95"
      >
        {/* Oversized conic rainbow behind the button; the button's rounded
            overflow-clip turns it into a 2px border. Hidden by default (the
            button's own bg-foreground/15 shows as a subtle light/dark border)
            and faded in on hover. `animate-ring` spins + hue-cycles it. */}
        <span
          aria-hidden
          className="animate-ring pointer-events-none absolute inset-[-150%] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "conic-gradient(from 0deg,#f87171,#fb923c,#fbbf24,#a3e635,#34d399,#22d3ee,#60a5fa,#a78bfa,#f472b6,#f87171)",
          }}
        />
        {/* Inner pill */}
        <span className="relative flex items-center gap-2 rounded-[8px] bg-popover/95 px-5 py-2.5 text-[13px] font-semibold text-foreground backdrop-blur-md">
          <RiMagicLine className="size-4" />
          Animate
        </span>
      </button>
    </div>
  )
}
