"use client"

import * as React from "react"
import {
  RiArrowRightUpLine,
  RiCrop2Line,
  RiCursorLine,
  RiFullscreenLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"

import { LayersPanelContent } from "@/components/editor/layers-popover"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Tool = "pointer" | "crop" | "text" | "arrow" | "layers" | "enhance"

export function FloatingToolbar() {
  const [active, setActive] = React.useState<Tool>("pointer")
  const [zoom, setZoom] = React.useState(100)

  const items: {
    id: Tool
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: "pointer", label: "Select", icon: RiCursorLine },
    { id: "crop", label: "Crop", icon: RiCrop2Line },
    { id: "text", label: "Text", icon: RiText },
    { id: "arrow", label: "Arrow", icon: RiArrowRightUpLine },
    { id: "layers", label: "Layers", icon: RiStackLine },
    { id: "enhance", label: "Enhance", icon: RiSparkling2Line },
  ]

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md">
        {items.map((it) => {
          const isActive = active === it.id
          const Icon = it.icon

          if (it.id === "layers") {
            return (
              <Popover key={it.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setActive(it.id)}
                    aria-label={it.label}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      isActive && "bg-accent text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={10}
                  className="w-auto p-0"
                >
                  <LayersPanelContent />
                </PopoverContent>
              </Popover>
            )
          }

          return (
            <Tooltip key={it.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActive(it.id)}
                  aria-label={it.label}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    isActive && "bg-accent text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{it.label}</TooltipContent>
            </Tooltip>
          )
        })}

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Zoom */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
              aria-label="Zoom out"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="text-base leading-none">−</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom out</TooltipContent>
        </Tooltip>

        <button
          onClick={() => setZoom(100)}
          className="tabular min-w-[3.25rem] rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent"
        >
          {zoom}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setZoom((z) => Math.min(400, z + 10))}
              aria-label="Zoom in"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="text-base leading-none">+</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom in</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setZoom(100)}
              aria-label="Fit"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RiFullscreenLine className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Fit</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
