"use client"

import { RiFocus2Line } from "@remixicon/react"

import type { Portrait } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import {
  PORTRAIT_MODES,
  portraitPreviewCss,
  type BackdropPickerLayout,
} from "./constants"

export function PortraitControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  portrait,
  portraitActive,
  pickerLayout,
  onOpenChange,
  onReset,
  setPortrait,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  portrait: Portrait
  portraitActive: boolean
  pickerLayout: BackdropPickerLayout
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setPortrait: (portrait: Portrait) => void
}) {
  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      icon={RiFocus2Line}
      label="Portrait"
      active={portraitActive}
      title="Portrait Mode"
      description="Cinematic depth - blends a vignette around your screenshot."
      onReset={onReset}
      resetTitle="Reset portrait"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      footer={
        portrait.mode !== "off" ? (
          <div className="space-y-3">
            <EffectSlider
              label="Intensity"
              value={portrait.intensity}
              onChange={(v) => setPortrait({ ...portrait, intensity: v })}
            />
            <EffectSlider
              label="Position"
              value={portrait.position}
              onChange={(v) => setPortrait({ ...portrait, position: v })}
              suffix=""
            />
            <EffectSlider
              label="Distance"
              value={portrait.distance}
              onChange={(v) => setPortrait({ ...portrait, distance: v })}
              suffix=""
            />
          </div>
        ) : null
      }
    >
      <div
        className={cn(
          pickerLayout === "carousel"
            ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            : "grid grid-cols-3 gap-1.5"
        )}
      >
        {PORTRAIT_MODES.map((m) => {
          const active = portrait.mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => setPortrait({ ...portrait, mode: m.id })}
              className={cn(
                "group relative flex aspect-square cursor-pointer flex-col items-center justify-end overflow-hidden rounded-lg border bg-neutral-900 p-1.5 transition-all",
                pickerLayout === "carousel" && "h-20 w-20 shrink-0",
                active
                  ? "border-foreground ring-1 ring-foreground/30"
                  : "border-border/60 hover:border-foreground/30"
              )}
              title={m.label}
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={portraitPreviewCss(m.id)}
              />
              <span
                className={cn(
                  "relative z-10 rounded-sm bg-black/60 px-1 text-[9px] font-medium text-white/95 backdrop-blur-sm",
                  active && "bg-foreground text-background"
                )}
              >
                {m.label}
              </span>
            </button>
          )
        })}
      </div>
    </BackdropControlPopover>
  )
}
