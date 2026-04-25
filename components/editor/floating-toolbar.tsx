"use client"

import * as React from "react"
import {
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiFocus3Line,
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
import {
  type EditorTool,
  SCREENSHOT_POSITIONS,
  type ScreenshotPosition,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

export function FloatingToolbar() {
  const {
    activeTool,
    setActiveTool,
    canvasZoom,
    setCanvasZoom,
    screenshotPosition,
    setScreenshotPosition,
  } = useEditor()

  const items: {
    id: EditorTool
    label: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: "pointer", label: "Select", icon: RiCursorLine },
    { id: "text", label: "Text", icon: RiText },
    { id: "arrow", label: "Arrow", icon: RiArrowRightUpLine },
    { id: "position", label: "Position", icon: RiDragMove2Line },
    { id: "layers", label: "Layers", icon: RiStackLine },
    { id: "enhance", label: "Enhance", icon: RiSparkling2Line },
  ]

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-full max-w-[calc(100vw-1.5rem)] -translate-x-1/2 px-3 sm:w-auto sm:px-0">
      <div className="pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const isActive = activeTool === it.id
          const Icon = it.icon

          if (it.id === "layers") {
            return (
              <Popover key={it.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setActiveTool(it.id)}
                    aria-label={it.label}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
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
                  className="w-auto p-0 border-border/60 bg-popover/95 backdrop-blur-md"
                >
                  <LayersPanelContent />
                </PopoverContent>
              </Popover>
            )
          }

          if (it.id === "position") {
            return (
              <Popover key={it.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => setActiveTool(it.id)}
                    aria-label={it.label}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
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
                  className="w-52 p-3 border-border/60 bg-popover/95 backdrop-blur-md"
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Position</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SCREENSHOT_POSITIONS.map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() =>
                            setScreenshotPosition(pos.id as ScreenshotPosition)
                          }
                          aria-label={`Move screenshot to ${positionLabel(pos.id)}`}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border transition-all cursor-pointer",
                            screenshotPosition === pos.id
                              ? "border-primary bg-primary text-white"
                              : "border-border/60 bg-secondary/40 text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          {pos.isCenter ? (
                            <RiFocus3Line className="size-3.5" />
                          ) : (
                            <RiArrowRightLine
                              className="size-3.5"
                              style={{ transform: `rotate(${pos.angle}deg)` }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )
          }

          return (
            <Tooltip key={it.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTool(it.id)}
                  aria-label={it.label}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
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
              onClick={() => setCanvasZoom(Math.max(25, canvasZoom - 10))}
              aria-label="Zoom out"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <span className="text-base leading-none">−</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom out</TooltipContent>
        </Tooltip>

        <button
          onClick={() => setCanvasZoom(100)}
          className="tabular min-w-[3.25rem] rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent cursor-pointer"
        >
          {canvasZoom}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCanvasZoom(Math.min(200, canvasZoom + 10))}
              aria-label="Zoom in"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <span className="text-base leading-none">+</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom in</TooltipContent>
        </Tooltip>

      </div>
    </div>
  )
}

function positionLabel(id: ScreenshotPosition) {
  if (id === "center") return "center"
  const [row, col] = id.split("-").map(Number)
  const vertical = ["top", "upper middle", "middle", "lower middle", "bottom"][
    row
  ]
  const horizontal = ["left", "left middle", "center", "right middle", "right"][
    col
  ]
  return `${vertical} ${horizontal}`
}
