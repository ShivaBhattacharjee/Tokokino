"use client"

import * as React from "react"

import { AspectPopover } from "@/components/editor/aspect-popover"
import {
  FramePopover,
  type FrameOrientation,
} from "@/components/editor/frame-popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { PRESETS } from "@/lib/editor/types"

export function EffectsSidebar() {
  const [aspect, setAspect] = React.useState<string>("16-10")
  const [customSize, setCustomSize] = React.useState<{
    w: number
    h: number
  } | null>(null)

  const [frame, setFrame] = React.useState<string>("browser")
  const [orientation, setOrientation] =
    React.useState<FrameOrientation>("horizontal")

  const [preset, setPreset] = React.useState<string>("paper-tilt")

  return (
    <aside className="flex h-full min-h-0 w-[268px] shrink-0 flex-col border-r border-border/60 bg-sidebar">
      {/* Sticky top: Aspect + Frame */}
      <div className="shrink-0 px-4 pt-5 pb-4">
        <SectionHeader>Aspect</SectionHeader>
        <AspectPopover
          value={aspect}
          onChange={(id, custom) => {
            setAspect(id)
            setCustomSize(custom ?? null)
          }}
        />
        {customSize ? (
          <p className="mt-1.5 px-0.5 font-mono text-[10px] text-muted-foreground">
            Custom · {customSize.w} × {customSize.h}
          </p>
        ) : null}

        <div className="my-5 h-px bg-border/60" />

        <SectionHeader>Frame</SectionHeader>
        <FramePopover
          value={frame}
          orientation={orientation}
          onChange={(id, ori) => {
            setFrame(id)
            setOrientation(ori)
          }}
        />
      </div>

      <div className="mx-4 h-px bg-border/60" />

      {/* Scrollable Presets */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pt-4 pb-2">
          <SectionHeader
            trailing={
              <span className="tabular font-mono text-[10px] text-muted-foreground">
                {PRESETS.length}
              </span>
            }
          >
            Presets
          </SectionHeader>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-3 px-4 pb-5">
            {PRESETS.map((p) => {
              const isActive = preset === p.id
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setPreset(p.id)}
                    className="group block w-full text-left"
                  >
                    <div
                      className={cn(
                        "relative flex h-[112px] items-center justify-center overflow-hidden rounded-xl border p-4 transition-colors",
                        isActive
                          ? "border-foreground/40"
                          : "border-border/60 hover:border-foreground/20"
                      )}
                      style={{ background: p.preview }}
                    >
                      <div
                        className={cn(
                          "h-[62%] w-[72%] rounded-md bg-background/90 shadow-sm ring-1 ring-black/5",
                          p.id === "paper-tilt" && "rotate-[-3deg]"
                        )}
                      />
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span
                        className={cn(
                          "text-[12px]",
                          isActive ? "text-foreground" : "text-foreground/80"
                        )}
                      >
                        {p.name}
                      </span>
                      <span className="tabular font-mono text-[10px] text-muted-foreground">
                        {p.index}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </div>
    </aside>
  )
}

function SectionHeader({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="label-eyebrow">{children}</span>
      {trailing}
    </div>
  )
}
