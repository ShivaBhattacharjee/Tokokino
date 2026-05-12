"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  AspectPopover,
  findAspectOption,
} from "@/components/editor/aspect-popover"
import { FramePopover } from "@/components/editor/frame-popover"
import { getFrameAspectCompatibilityWarning } from "@/lib/editor/frame-aspect-compatibility"
import { cn } from "@/lib/utils"
import { useEditor, useSelectedScreenshotSlot } from "@/lib/editor/store"
import type { AspectState, DeviceFrame } from "@/lib/editor/store"

export function EffectsSidebar({
  className,
}: {
  className?: string
  stacked?: boolean
}) {
  const { aspect, frame, setAspect, setFrame, updateScreenshotSlot } =
    useEditor()
  const selectedSlot = useSelectedScreenshotSlot()
  const activeFrame = selectedSlot?.frame ?? frame

  const [customSize, setCustomSize] = React.useState<{
    w: number
    h: number
  } | null>(null)

  const showCompatibilityWarning = React.useCallback(
    (nextAspect: AspectState, nextFrame: DeviceFrame, aspectName?: string) => {
      const warning = getFrameAspectCompatibilityWarning({
        aspect: nextAspect,
        frame: nextFrame,
        aspectName,
      })

      if (!warning) return

      toast.warning(warning.title, {
        description: warning.description,
        id: "frame-aspect-compatibility",
        position: "top-center",
      })
    },
    []
  )

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[268px] shrink-0 flex-col border-r border-dashed border-border/70 bg-sidebar",
        className
      )}
    >
      <div className="shrink-0 px-4 pt-5 pb-4">
        <span className="label-eyebrow mb-4 block">Canvas</span>
        <div className="space-y-4">
          <div>
            <SectionLabel>Aspect Ratio</SectionLabel>
            <AspectPopover
              value={aspect.id}
              onChange={(id, custom) => {
                if (custom) {
                  const nextAspect = { id, w: custom.w, h: custom.h }
                  setAspect(nextAspect)
                  setCustomSize(custom)
                  showCompatibilityWarning(
                    nextAspect,
                    activeFrame,
                    "Custom size"
                  )
                  return
                }
                const opt = findAspectOption(id)
                if (opt) {
                  const nextAspect = { id, w: opt.w, h: opt.h }
                  setAspect(nextAspect)
                  setCustomSize(null)
                  showCompatibilityWarning(nextAspect, activeFrame, opt.name)
                }
              }}
            />
            {customSize ? (
              <p className="mt-1.5 px-0.5 font-mono text-[10px] text-muted-foreground">
                Custom · {customSize.w} × {customSize.h}
              </p>
            ) : null}
          </div>
          <div>
            <SectionLabel>Frame</SectionLabel>
            <FramePopover
              value={activeFrame}
              previewImage={selectedSlot ? selectedSlot.src : undefined}
              onChange={(nextFrame) => {
                if (selectedSlot) {
                  updateScreenshotSlot(selectedSlot.id, { frame: nextFrame })
                  return
                }
                setFrame(nextFrame)
                showCompatibilityWarning(
                  aspect,
                  nextFrame,
                  findAspectOption(aspect.id)?.name
                )
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[13px] font-medium text-foreground">{children}</p>
  )
}
