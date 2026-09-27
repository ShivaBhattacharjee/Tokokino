"use client"

import { RiFocus2Line } from "@remixicon/react"

import { portraitOverlayCss } from "@/components/editor/canvas/helpers"
import type {
  Background,
  Portrait,
  PortraitMode,
} from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import {
  PORTRAIT_MODES,
  portraitPreviewCss,
  type BackdropPickerLayout,
} from "./constants"
import { useLayerPreviewStyle } from "./use-layer-preview"

// The canvas vignette is sized for a full canvas; a picker tile is ~1/12 of
// that, so the inset frame shadow has to shrink with it.
function portraitTileOverlayCss(
  mode: PortraitMode,
  portrait: Portrait
): React.CSSProperties | null {
  const intensity = portrait.intensity || 60
  if (mode === "frame") {
    const t = intensity / 100
    return {
      boxShadow: `inset 0 0 ${20 * t}px ${8 * t}px rgba(0,0,0,${0.7 * t})`,
    }
  }
  return portraitOverlayCss(
    mode,
    intensity,
    portrait.position,
    portrait.distance
  )
}

export function PortraitControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  portrait,
  portraitActive,
  pickerLayout,
  mediaSrc,
  background,
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
  mediaSrc: string | null
  background: Background
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  setPortrait: (portrait: Portrait) => void
}) {
  const mediaPreview = useLayerPreviewStyle("media", mediaSrc, background)
  const backgroundPreview = useLayerPreviewStyle(
    "background",
    mediaSrc,
    background
  )
  const preview = mediaPreview ?? backgroundPreview

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
                style={preview ?? portraitPreviewCss(m.id)}
              />
              {preview ? (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={portraitTileOverlayCss(m.id, portrait) ?? undefined}
                />
              ) : null}
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
