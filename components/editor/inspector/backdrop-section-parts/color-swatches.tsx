"use client"

import { RiGradienterLine } from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { cn } from "@/lib/utils"

import { ACTIVE_COLOR_SWATCH_CLASS } from "./constants"

export function ColorSwatches({
  presets,
  value,
  onChange,
  label,
  allowTransparent = false,
}: {
  presets: string[]
  value: string
  onChange: (color: string) => void
  label: string
  allowTransparent?: boolean
}) {
  const normalized = value.trim().toLowerCase()
  const isPreset =
    presets.some((c) => c.trim().toLowerCase() === normalized) ||
    normalized === "transparent"

  return (
    <div>
      <span className="mb-2 block text-[11px] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {allowTransparent ? (
          <button
            onClick={() => onChange("transparent")}
            aria-label={`${label}: transparent`}
            aria-pressed={normalized === "transparent"}
            title="Transparent"
            className={cn(
              "bg-transparency-checker size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
              normalized === "transparent" && ACTIVE_COLOR_SWATCH_CLASS
            )}
          />
        ) : null}
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            aria-label={`${label}: ${c}`}
            aria-pressed={normalized === c.trim().toLowerCase()}
            title={c}
            className={cn(
              "size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
              normalized === c.trim().toLowerCase() && ACTIVE_COLOR_SWATCH_CLASS
            )}
            style={{ background: c }}
          />
        ))}
        <ColorPickerPopover value={value} onChange={onChange}>
          <button
            aria-label={`Custom ${label.toLowerCase()}`}
            className={cn(
              "relative size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
              !isPreset && ACTIVE_COLOR_SWATCH_CLASS
            )}
            style={{
              background: isPreset
                ? "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)"
                : value,
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white">
              <RiGradienterLine className="size-3.5" />
            </span>
          </button>
        </ColorPickerPopover>
      </div>
    </div>
  )
}
