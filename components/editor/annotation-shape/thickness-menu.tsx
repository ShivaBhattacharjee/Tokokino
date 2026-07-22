"use client"

import { ElasticSlider } from "@/components/elastic-slider"
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
      <ElasticSlider
        label="Thickness"
        value={value}
        min={1}
        max={24}
        step={1}
        formatValue={(v) => `${Math.round(v)}px`}
        onValueChange={onChange}
      />
    </div>
  )
}
