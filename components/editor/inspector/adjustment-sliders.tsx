"use client"

import type { MediaAdjustments } from "@/lib/editor/state-types"

import { EffectSlider } from "./effect-slider"

/**
 * The colour-grade slider stack. The backdrop layer and the screenshot/video
 * media grade through the same knobs, so both sections render this and add only
 * the extras they own (the backdrop adds noise and opacity).
 */
export function AdjustmentSliders({
  adjustments,
  commit,
  preview,
}: {
  adjustments: MediaAdjustments
  commit: (patch: Partial<MediaAdjustments>) => void
  preview: (patch: Partial<MediaAdjustments>) => void
}) {
  return (
    <>
      <EffectSlider
        label="Brightness"
        value={adjustments.brightness}
        onChange={(v) => commit({ brightness: v })}
        onPreview={(v) => preview({ brightness: v })}
        max={200}
      />
      <EffectSlider
        label="Contrast"
        value={adjustments.contrast}
        onChange={(v) => commit({ contrast: v })}
        onPreview={(v) => preview({ contrast: v })}
        max={200}
      />
      <EffectSlider
        label="Saturation"
        value={adjustments.saturation}
        onChange={(v) => commit({ saturation: v })}
        onPreview={(v) => preview({ saturation: v })}
        max={200}
      />
      <EffectSlider
        label="Hue"
        value={adjustments.hue}
        onChange={(v) => commit({ hue: v })}
        onPreview={(v) => preview({ hue: v })}
        max={360}
        suffix="°"
      />
      <EffectSlider
        label="Grayscale"
        value={adjustments.grayscale}
        onChange={(v) => commit({ grayscale: v })}
        onPreview={(v) => preview({ grayscale: v })}
      />
      <EffectSlider
        label="Sepia"
        value={adjustments.sepia}
        onChange={(v) => commit({ sepia: v })}
        onPreview={(v) => preview({ sepia: v })}
      />
      <EffectSlider
        label="Invert"
        value={adjustments.invert}
        onChange={(v) => commit({ invert: v })}
        onPreview={(v) => preview({ invert: v })}
      />
      <EffectSlider
        label="Blur"
        value={adjustments.blur}
        onChange={(v) => commit({ blur: v })}
        onPreview={(v) => preview({ blur: v })}
        max={20}
        suffix="px"
      />
    </>
  )
}
