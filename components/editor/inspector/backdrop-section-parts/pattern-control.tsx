"use client"

import { RiGradienterLine, RiGridLine } from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import type { BackdropPattern } from "@/lib/editor/state-types"
import { BACKDROP_PATTERNS, patternCssFor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import {
  ACTIVE_COLOR_SWATCH_CLASS,
  type BackdropPickerLayout,
} from "./constants"

export function PatternControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  pattern,
  patternActive,
  patternColors,
  pickerLayout,
  onOpenChange,
  onReset,
  setPattern,
  setPreviewVar,
  clearPreviewVarAfterPaint,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  pattern: BackdropPattern
  patternActive: boolean
  patternColors: string[]
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setPattern: (patch: Partial<BackdropPattern>) => void
  setPreviewVar: (name: string, value: string | null) => void
  clearPreviewVarAfterPaint: (name: string) => void
}) {
  const isPresetColor = patternColors.some(
    (c) => c.trim().toLowerCase() === pattern.color.trim().toLowerCase()
  )

  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      icon={RiGridLine}
      label="Pattern"
      active={patternActive}
      title="Patterns"
      description="Layer geometric textures on top of your backdrop."
      onReset={onReset}
      resetTitle="Reset patterns"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      contentClassName="w-[240px]"
      bodyClassName="pr-1"
      footer={
        <div className="space-y-3">
          <EffectSlider
            label="Intensity"
            value={pattern.intensity}
            onChange={(v) => {
              setPattern({ intensity: v })
              clearPreviewVarAfterPaint("--bd-pattern-intensity")
            }}
            onPreview={(v) =>
              setPreviewVar("--bd-pattern-intensity", `${v / 100}`)
            }
          />

          <EffectSlider
            label="Thickness"
            value={pattern.thickness}
            onChange={(v) => setPattern({ thickness: v })}
            min={1}
            max={10}
            step={0.5}
            suffix="px"
          />

          <div>
            <span className="mb-2 block text-[11px] text-muted-foreground">
              Colour
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {patternColors.map((c) => {
                const isActive =
                  pattern.color.trim().toLowerCase() === c.trim().toLowerCase()
                return (
                  <button
                    key={c}
                    onClick={() => setPattern({ color: c })}
                    className={cn(
                      "size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                      isActive && ACTIVE_COLOR_SWATCH_CLASS
                    )}
                    style={{ background: c }}
                  />
                )
              })}
              <ColorPickerPopover
                value={pattern.color}
                onChange={(hex) => setPattern({ color: hex })}
              >
                <button
                  aria-label="Custom pattern color"
                  className={cn(
                    "relative size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                    !isPresetColor && ACTIVE_COLOR_SWATCH_CLASS
                  )}
                  style={{
                    background: isPresetColor
                      ? "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)"
                      : pattern.color,
                  }}
                >
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white">
                    <RiGradienterLine className="size-3.5" />
                  </span>
                </button>
              </ColorPickerPopover>
            </div>
          </div>
        </div>
      }
    >
      <div
        className={cn(
          pickerLayout === "carousel"
            ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            : "grid grid-cols-3 gap-2 pr-1"
        )}
      >
        <button
          key="none"
          onClick={() => setPattern({ ids: [] })}
          title="None"
          className={cn(
            "relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-secondary/40 text-[10px] font-medium text-muted-foreground transition-all",
            pickerLayout === "carousel" && "h-20 w-20 shrink-0",
            pattern.ids.length === 0
              ? "border-foreground text-foreground ring-1 ring-foreground/30"
              : "border-dashed border-border/60 hover:border-foreground/30 hover:text-foreground"
          )}
        >
          None
        </button>
        {BACKDROP_PATTERNS.map((p) => {
          const selected = pattern.ids.includes(p.id)
          return (
            <button
              key={p.id}
              onClick={() =>
                setPattern({
                  ids: selected
                    ? pattern.ids.filter((v) => v !== p.id)
                    : [...pattern.ids, p.id],
                })
              }
              style={patternCssFor(p.id, pattern.color, pattern.thickness)}
              className={cn(
                "relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-neutral-900 transition-all",
                pickerLayout === "carousel" && "h-20 w-20 shrink-0",
                selected
                  ? "border-foreground ring-1 ring-foreground/30"
                  : "border-border/60 hover:border-foreground/30"
              )}
              title={p.name}
            />
          )
        })}
      </div>
    </BackdropControlPopover>
  )
}
