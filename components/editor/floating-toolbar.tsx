"use client"

import * as React from "react"
import {
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiCursorLine,
  RiDragMove2Line,
  RiFocus3Line,
  RiImageAddLine,
  RiSparkling2Line,
  RiStackLine,
  RiText,
} from "@remixicon/react"
import { toast } from "sonner"

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
  type EnhancePreset,
  SCREENSHOT_POSITIONS,
  type ScreenshotPosition,
  useEditor,
} from "@/lib/editor/store"
import { cn } from "@/lib/utils"

const ENHANCE_PRESETS: {
  id: EnhancePreset
  label: string
  swatch: string
  filter?: string
}[] = [
    { id: "off", label: "Off", swatch: "linear-gradient(135deg,#888,#555)" },
    {
      id: "auto",
      label: "Auto",
      swatch: "linear-gradient(135deg,#7dd3fc,#a78bfa)",
      filter: "brightness(1.04) contrast(1.08) saturate(1.1)",
    },
    {
      id: "vivid",
      label: "Vivid",
      swatch: "linear-gradient(135deg,#f43f5e,#f59e0b)",
      filter: "saturate(1.35) contrast(1.12)",
    },
    {
      id: "soft",
      label: "Soft",
      swatch: "linear-gradient(135deg,#fde2e4,#cdb4db)",
      filter: "brightness(1.06) saturate(0.9)",
    },
    {
      id: "dramatic",
      label: "Dramatic",
      swatch: "linear-gradient(135deg,#1f2937,#6b7280)",
      filter: "contrast(1.25) saturate(1.2)",
    },
    {
      id: "sharp",
      label: "Sharp",
      swatch: "linear-gradient(135deg,#10b981,#0ea5e9)",
      filter: "contrast(1.18)",
    },
  ]

export function FloatingToolbar() {
  const {
    activeTool,
    setActiveTool,
    screenshotPosition,
    setScreenshotPosition,
    addText,
    setSelectedTextId,
    addAsset,
    setSelectedAssetId,
    screenshot,
    enhance,
    setEnhance,
    scale,
    setScale,
  } = useEditor()
  const assetInputRef = React.useRef<HTMLInputElement>(null)

  const handleAssetUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const id = addAsset(reader.result)
        setSelectedAssetId(id)
        setSelectedTextId(null)
        setActiveTool("pointer")
      }
    }
    reader.readAsDataURL(file)
  }

  const handleToolClick = (id: EditorTool) => {
    if (id === "text") {
      const newId = addText()
      setSelectedTextId(newId)
      setActiveTool("pointer")
      // Color auto-detection is handled by TextElementView's mount effect
      return
    }
    setActiveTool(id)
  }

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
      <input
        ref={assetInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files) {
            for (const f of Array.from(files)) handleAssetUpload(f)
          }
          e.target.value = ""
        }}
      />
      <div className="pointer-events-auto flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border/70 bg-popover/90 p-1 shadow-lg backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => assetInputRef.current?.click()}
              aria-label="Add asset"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <RiImageAddLine className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Add asset (image)</TooltipContent>
        </Tooltip>
        <span className="mx-1 h-5 w-px bg-border" />
        {items.map((it) => {
          const isActive = activeTool === it.id
          const Icon = it.icon

          if (it.id === "layers") {
            return (
              <Popover key={it.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => handleToolClick(it.id)}
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

          if (it.id === "enhance") {
            const isOn = enhance !== "off"
            return (
              <Popover key={it.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        aria-label={it.label}
                        disabled={!screenshot}
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
                          isOn && "bg-accent text-foreground",
                          !screenshot && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Icon className="size-4" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {screenshot ? "Enhance image" : "Add a screenshot first"}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={10}
                  className="w-56 p-2 border-border/60 bg-popover/95 backdrop-blur-md"
                >
                  <div className="flex flex-col gap-2">
                    <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Enhance
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {ENHANCE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setEnhance(p.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-all cursor-pointer",
                            enhance === p.id
                              ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
                              : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          <span
                            className="block size-6 rounded-full border border-border/60"
                            style={{
                              background: p.swatch,
                              filter: p.filter,
                            }}
                          />
                          <span className="font-medium">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )
          }

          if (it.id === "position") {
            return (
              <Popover key={it.id}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => handleToolClick(it.id)}
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
                  onClick={() => handleToolClick(it.id)}
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
              disabled={!screenshot}
              onClick={() => setScale(Math.max(10, scale - 10))}
              aria-label="Zoom out"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
                !screenshot && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className="text-base leading-none">−</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {screenshot ? "Zoom out" : "Add a screenshot first"}
          </TooltipContent>
        </Tooltip>

        <button
          disabled={!screenshot}
          onClick={() => setScale(100)}
          className={cn(
            "tabular min-w-[3.25rem] rounded-md px-1 py-1.5 font-mono text-[11px] text-foreground/85 hover:bg-accent cursor-pointer",
            !screenshot && "opacity-40 cursor-not-allowed"
          )}
        >
          {scale}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              disabled={!screenshot}
              onClick={() => setScale(Math.min(300, scale + 10))}
              aria-label="Zoom in"
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer",
                !screenshot && "opacity-40 cursor-not-allowed"
              )}
            >
              <span className="text-base leading-none">+</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {screenshot ? "Zoom in" : "Add a screenshot first"}
          </TooltipContent>
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
