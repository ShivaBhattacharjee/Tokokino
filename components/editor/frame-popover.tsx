"use client"

import * as React from "react"
import {
  RiArrowRightSLine,
  RiCheckboxBlankCircleLine,
  RiCheckLine,
  RiMacLine,
  RiSmartphoneLine,
  RiWindowLine,
} from "@remixicon/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type FrameOption = {
  id: string
  name: string
  description?: string
  orientable: boolean
  icon: React.ComponentType<{ className?: string }>
}

const FRAME_OPTIONS: FrameOption[] = [
  {
    id: "browser",
    name: "Browser",
    description: "macOS-style window",
    orientable: false,
    icon: RiWindowLine,
  },
  {
    id: "macos",
    name: "macOS",
    description: "Desktop window",
    orientable: false,
    icon: RiMacLine,
  },
  {
    id: "iphone",
    name: "iPhone",
    description: "15 / 16 Pro",
    orientable: true,
    icon: RiSmartphoneLine,
  },
  {
    id: "android",
    name: "Pixel",
    description: "Pixel 9",
    orientable: true,
    icon: RiSmartphoneLine,
  },
  {
    id: "tablet",
    name: "iPad",
    description: "13″ Pro",
    orientable: true,
    icon: RiSmartphoneLine,
  },
  {
    id: "none",
    name: "None",
    description: "Bare screenshot",
    orientable: false,
    icon: RiCheckboxBlankCircleLine,
  },
]

export type FrameOrientation = "vertical" | "horizontal"

export function FramePopover({
  value,
  orientation,
  onChange,
}: {
  value: string
  orientation: FrameOrientation
  onChange: (id: string, orientation: FrameOrientation) => void
}) {
  const [open, setOpen] = React.useState(false)
  const current = FRAME_OPTIONS.find((o) => o.id === value) ?? FRAME_OPTIONS[0]
  const Icon = current.icon

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group relative flex h-11 w-full items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/50 px-3 text-left transition-colors hover:bg-secondary/80",
            open && "bg-secondary/80"
          )}
        >
          <span className="inline-flex size-5 items-center justify-center text-foreground/85">
            <Icon className="size-4" />
          </span>
          <span className="flex-1 text-[13px] text-foreground">
            {current.name}
          </span>
          {current.orientable ? (
            <span className="font-mono text-[10px] text-muted-foreground capitalize">
              {orientation}
            </span>
          ) : null}
          <RiArrowRightSLine
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="w-[280px] gap-0 p-0"
      >
        {/* Orientation */}
        <div className="border-b border-border/60 p-2">
          <div className="mb-1.5 px-1 label-eyebrow !text-[9px]">
            Orientation
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/40 p-0.5">
            {(["vertical", "horizontal"] as const).map((o) => {
              const isActive = orientation === o
              const disabled = !current.orientable
              return (
                <button
                  key={o}
                  disabled={disabled}
                  onClick={() => onChange(current.id, o)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-[11px] capitalize transition-colors",
                    isActive && !disabled
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground",
                    !disabled && "hover:text-foreground",
                    disabled && "opacity-40"
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <OrientGlyph orientation={o} active={isActive && !disabled} />
                    {o}
                  </span>
                </button>
              )
            })}
          </div>
          {!current.orientable ? (
            <p className="mt-1.5 px-1 font-mono text-[10px] text-muted-foreground">
              {current.name} doesn&apos;t support rotation.
            </p>
          ) : null}
        </div>

        {/* Devices list */}
        <ul className="p-1">
          {FRAME_OPTIONS.map((f) => {
            const Icon = f.icon
            const isActive = value === f.id
            return (
              <li key={f.id}>
                <button
                  onClick={() => {
                    onChange(f.id, orientation)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    isActive ? "bg-accent" : "hover:bg-accent/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded border border-border/60 bg-background/40",
                      isActive && "border-foreground/40"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-tight">{f.name}</div>
                    {f.description ? (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {f.description}
                      </div>
                    ) : null}
                  </div>
                  {isActive ? (
                    <RiCheckLine className="size-3.5 text-foreground" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function OrientGlyph({
  orientation,
  active,
}: {
  orientation: FrameOrientation
  active?: boolean
}) {
  const color = active ? "bg-foreground" : "bg-foreground/50"
  return (
    <span
      aria-hidden
      className="flex size-4 items-center justify-center"
    >
      <span
        className={cn(
          "rounded-[2px]",
          color,
          orientation === "horizontal" ? "h-2 w-3.5" : "h-3.5 w-2"
        )}
      />
    </span>
  )
}
