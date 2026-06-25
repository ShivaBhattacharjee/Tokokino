"use client"

import { RiEqualizerLine } from "@remixicon/react"

import type { BackdropEffects } from "@/lib/editor/state-types"

import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"

export function EffectsControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  effects,
  effectsDirty,
  onOpenChange,
  onReset,
  commitEffects,
  previewEffects,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  effects: BackdropEffects
  effectsDirty: boolean
  onOpenChange?: (open: boolean) => void
  onReset: () => void
  commitEffects: (patch: Partial<BackdropEffects>) => void
  previewEffects: (patch: Partial<BackdropEffects>) => void
}) {
  return (
    <BackdropControlPopover
      popoverSide={popoverSide}
      presentation={controlsVariant}
      hideTriggerWhenOpen={usesInlineControls}
      inlineBodyMode="content"
      icon={RiEqualizerLine}
      label="Effects"
      active={effectsDirty}
      title="Effects"
      description="Color & filter adjustments applied to the backdrop layer."
      onReset={onReset}
      resetTitle="Reset effects"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      contentClassName="w-[240px]"
      bodyClassName="space-y-2.5 pr-1"
    >
      <EffectSlider
        label="Brightness"
        value={effects.brightness}
        onChange={(v) => commitEffects({ brightness: v })}
        onPreview={(v) => previewEffects({ brightness: v })}
        max={200}
      />
      <EffectSlider
        label="Contrast"
        value={effects.contrast}
        onChange={(v) => commitEffects({ contrast: v })}
        onPreview={(v) => previewEffects({ contrast: v })}
        max={200}
      />
      <EffectSlider
        label="Saturation"
        value={effects.saturation}
        onChange={(v) => commitEffects({ saturation: v })}
        onPreview={(v) => previewEffects({ saturation: v })}
        max={200}
      />
      <EffectSlider
        label="Hue"
        value={effects.hue}
        onChange={(v) => commitEffects({ hue: v })}
        onPreview={(v) => previewEffects({ hue: v })}
        max={360}
        suffix="°"
      />
      <EffectSlider
        label="Grayscale"
        value={effects.grayscale}
        onChange={(v) => commitEffects({ grayscale: v })}
        onPreview={(v) => previewEffects({ grayscale: v })}
      />
      <EffectSlider
        label="Sepia"
        value={effects.sepia}
        onChange={(v) => commitEffects({ sepia: v })}
        onPreview={(v) => previewEffects({ sepia: v })}
      />
      <EffectSlider
        label="Invert"
        value={effects.invert}
        onChange={(v) => commitEffects({ invert: v })}
        onPreview={(v) => previewEffects({ invert: v })}
      />
      <EffectSlider
        label="Blur"
        value={effects.blur}
        onChange={(v) => commitEffects({ blur: v })}
        onPreview={(v) => previewEffects({ blur: v })}
        max={20}
        suffix="px"
      />
      <EffectSlider
        label="Noise"
        value={effects.noise}
        onChange={(v) => commitEffects({ noise: v })}
        onPreview={(v) => previewEffects({ noise: v })}
      />
      <EffectSlider
        label="Opacity"
        value={effects.opacity}
        onChange={(v) => commitEffects({ opacity: v })}
        onPreview={(v) => previewEffects({ opacity: v })}
      />
    </BackdropControlPopover>
  )
}
