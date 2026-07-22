"use client"

import { RiEqualizerLine, RiRefreshLine } from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { ElasticSlider } from "@/components/elastic-slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { GRADIENT_COLOR_CONTROLS } from "./constants"

export function GradientCustomizerPopover({
  ariaLabel,
  config,
  canReset,
  onAngleChange,
  onColorChange,
  onReset,
}: {
  ariaLabel: string
  config: { angle: number; colors: string[] }
  canReset: boolean
  onAngleChange: (v: number) => void
  onColorChange: (idx: number, color: string) => void
  onReset: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={ariaLabel}
          className="absolute inset-0 z-10 m-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          <RiEqualizerLine className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-[300px] space-y-4 border-border/60 bg-popover/95 p-3"
      >
        <div className="flex items-center gap-2">
          <ElasticSlider
            label="Angle"
            value={config.angle}
            onValueChange={onAngleChange}
            min={0}
            max={360}
            step={1}
            formatValue={(v) => `${Math.round(v)}°`}
            className="min-w-0 flex-1"
          />
          <button
            aria-label="Reset gradient"
            disabled={!canReset}
            onClick={onReset}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/30 text-muted-foreground transition-colors",
              canReset
                ? "cursor-pointer hover:border-foreground/30 hover:text-foreground"
                : "cursor-not-allowed opacity-40"
            )}
          >
            <RiRefreshLine className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {GRADIENT_COLOR_CONTROLS.map(({ id, label }, colorIndex) => (
            <ColorPickerPopover
              key={id}
              value={config.colors[colorIndex]}
              onChange={(colorValue) => onColorChange(colorIndex, colorValue)}
            >
              <button className="flex h-10 cursor-pointer items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 text-left transition-colors hover:border-foreground/30">
                <span className="text-[11px] text-muted-foreground">
                  {label}
                </span>
                <span
                  className="size-5 rounded-full border border-border/60"
                  style={{ background: config.colors[colorIndex] }}
                />
              </button>
            </ColorPickerPopover>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
