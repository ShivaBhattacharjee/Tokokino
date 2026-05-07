"use client"

import * as React from "react"

import {
  AspectPopover,
  findAspectOption,
} from "@/components/editor/aspect-popover"
import { FramePopover } from "@/components/editor/frame-popover"
import { cn } from "@/lib/utils"
import { useEditor } from "@/lib/editor/store"

export function EffectsSidebar({
  className,
  stacked = false,
}: {
  className?: string
  stacked?: boolean
}) {
  const { aspect, frame, setAspect, setFrame } = useEditor()

  const [customSize, setCustomSize] = React.useState<{
    w: number
    h: number
  } | null>(null)

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[268px] shrink-0 flex-col border-r border-dashed border-border/70 bg-sidebar",
        className
      )}
    >
      {/* Sticky top: Aspect + Frame — row on mobile/iPad, stacked on desktop */}
      <div className="shrink-0 px-4 pt-5 pb-4">
        <div
          className={cn(
            "grid grid-cols-2 gap-3 xl:block xl:gap-0",
            stacked && "!block !gap-0"
          )}
        >
          <div>
            <SectionHeader>Aspect</SectionHeader>
            <AspectPopover
              value={aspect.id}
              onChange={(id, custom) => {
                if (custom) {
                  setAspect({ id, w: custom.w, h: custom.h })
                  setCustomSize(custom)
                  return
                }
                const opt = findAspectOption(id)
                if (opt) {
                  setAspect({ id, w: opt.w, h: opt.h })
                  setCustomSize(null)
                }
              }}
            />
            {customSize ? (
              <p className="mt-1.5 px-0.5 font-mono text-[10px] text-muted-foreground">
                Custom · {customSize.w} × {customSize.h}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "xl:mt-5 xl:border-t xl:border-border/60 xl:pt-5",
              stacked && "!mt-5 !border-t !border-border/60 !pt-5"
            )}
          >
            <SectionHeader>Frame</SectionHeader>
            <FramePopover value={frame} onChange={setFrame} />
          </div>
        </div>
      </div>
    </aside>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <span className="label-eyebrow">{children}</span>
    </div>
  )
}
