"use client"

import * as React from "react"
import { RiEqualizerLine } from "@remixicon/react"

import { Slider } from "@/components/ui/slider"
import { ANNOTATION_STROKES } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

export function ThicknessMenuSection({
  value,
  color,
  onChange,
}: {
  value: number
  color: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-3 px-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          <RiEqualizerLine className="size-4 text-muted-foreground" />
          Thickness
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {value}px
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {ANNOTATION_STROKES.map((strokeWidth) => {
          const isActive = value === strokeWidth
          return (
            <button
              key={strokeWidth}
              aria-label={`${strokeWidth}px thickness`}
              onClick={() => onChange(strokeWidth)}
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-md border border-transparent transition-colors hover:bg-accent",
                isActive && "border-border bg-accent"
              )}
            >
              <span
                className="block rounded-full"
                style={{
                  width: Math.min(24, strokeWidth * 2 + 6),
                  height: Math.min(24, strokeWidth * 2 + 6),
                  background: color,
                }}
              />
            </button>
          )
        })}
      </div>
      <Slider
        value={[value]}
        min={1}
        max={24}
        step={1}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  )
}
