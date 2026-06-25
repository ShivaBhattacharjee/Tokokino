"use client"

import { RiGradienterLine, RiSunLine } from "@remixicon/react"

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { BackdropLighting } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import {
  ACTIVE_COLOR_SWATCH_CLASS,
  LIGHTING_COLOR_PRESETS,
  LIGHTING_DIRECTIONS,
  lightingDirectionPreview,
  type BackdropPickerLayout,
} from "./constants"

export function LightingControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  activeLighting,
  lightingActive,
  pickerLayout,
  onOpenChange,
  onReset,
  setLighting,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  activeLighting: BackdropLighting
  lightingActive: boolean
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setLighting: (patch: Partial<BackdropLighting>) => void
}) {
  const isPresetColor = LIGHTING_COLOR_PRESETS.some(
    (c) => c.trim().toLowerCase() === activeLighting.color.trim().toLowerCase()
  )

  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      icon={RiSunLine}
      label="Lighting"
      active={lightingActive}
      title="Lighting"
      description="Cast directional light on the backdrop or the screenshot."
      onReset={onReset}
      resetTitle="Reset lighting"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      contentClassName="w-[240px]"
      bodyClassName="pr-1 overflow-y-auto max-h-[140px] md:max-h-[min(220px,calc(100vh-10rem))]"
      footer={
        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground">Target</span>
            <ToggleGroup
              type="single"
              value={activeLighting.target}
              onValueChange={(v) =>
                v && setLighting({ target: v as "outer" | "inner" })
              }
              className="flex w-full rounded-md bg-secondary/60 p-1"
            >
              <ToggleGroupItem
                value="inner"
                className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
              >
                Inner
              </ToggleGroupItem>
              <ToggleGroupItem
                value="outer"
                className="h-7 flex-1 cursor-pointer rounded-[4px] text-[10px] hover:bg-transparent hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
              >
                Outer
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <EffectSlider
            label="Intensity"
            value={activeLighting.intensity}
            onChange={(v) => setLighting({ intensity: v })}
          />

          <div>
            <span className="mb-2 block text-[11px] text-muted-foreground">
              Colour
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {LIGHTING_COLOR_PRESETS.map((c) => {
                const isActive =
                  activeLighting.color.trim().toLowerCase() ===
                  c.trim().toLowerCase()
                return (
                  <button
                    key={c}
                    onClick={() => setLighting({ color: c })}
                    className={cn(
                      "size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                      isActive && ACTIVE_COLOR_SWATCH_CLASS
                    )}
                    style={{ background: c }}
                  />
                )
              })}
              <ColorPickerPopover
                value={activeLighting.color}
                onChange={(hex) => setLighting({ color: hex })}
              >
                <button
                  aria-label="Custom lighting color"
                  className={cn(
                    "relative size-8 cursor-pointer rounded-full border border-border/60 transition-transform hover:scale-110",
                    !isPresetColor && ACTIVE_COLOR_SWATCH_CLASS
                  )}
                  style={{
                    background: isPresetColor
                      ? "conic-gradient(from 180deg at 50% 50%, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f472b6, #f87171)"
                      : activeLighting.color,
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
            : "grid grid-cols-3 gap-1.5 px-1 py-1"
        )}
      >
        {LIGHTING_DIRECTIONS.map((direction) => {
          const active =
            lightingActive && activeLighting.direction === direction.id
          return (
            <button
              key={direction.id}
              onClick={() => setLighting({ direction: direction.id })}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 rounded-md border bg-secondary/20 p-1 transition-all",
                pickerLayout === "carousel" && "w-20 shrink-0",
                active
                  ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                  : "border-border/60 hover:border-foreground/30"
              )}
              title={direction.label}
            >
              <div
                className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-950"
                style={lightingDirectionPreview(
                  direction.id,
                  activeLighting.color
                )}
              >
                <span
                  className={cn(
                    "absolute inset-0 m-auto size-1.5 rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
                    active && "bg-primary"
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>
    </BackdropControlPopover>
  )
}
