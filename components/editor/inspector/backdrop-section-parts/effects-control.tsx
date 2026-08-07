"use client"

import { RiEqualizerLine } from "@remixicon/react"

import type { BackdropEffects } from "@/lib/editor/state-types"

import { AdjustmentSliders } from "../adjustment-sliders"
import { EffectSlider } from "../effect-slider"
import { BackdropControlPopover } from "./control-popover"
import type { BackdropLayerTarget } from "./constants"
import { LayerTargetToggle } from "./layer-target-toggle"
import type { LayerGrade } from "./layer-grade"

export function EffectsControl({
  popoverSide,
  controlsVariant,
  usesInlineControls,
  inlineOpen,
  target,
  onTargetChange,
  grade,
  effects,
  onOpenChange,
  commitEffects,
  previewEffects,
}: {
  popoverSide: "left" | "top"
  controlsVariant: "popover" | "inline"
  usesInlineControls: boolean
  inlineOpen: boolean
  target: BackdropLayerTarget
  onTargetChange: (target: BackdropLayerTarget) => void
  /** The adjustments the toggle currently points at. */
  grade: LayerGrade
  /** Backdrop-only channels — noise and opacity have no media equivalent. */
  effects: BackdropEffects
  onOpenChange?: (open: boolean) => void
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
      active={grade.dirty}
      title="Effects"
      description={
        target === "backdrop"
          ? "Color & filter adjustments applied to the backdrop layer."
          : "Color & filter adjustments applied to the screenshot or video."
      }
      onReset={grade.reset}
      resetTitle="Reset effects"
      open={usesInlineControls ? inlineOpen : undefined}
      onOpenChange={usesInlineControls ? onOpenChange : undefined}
      contentClassName="w-[240px]"
      bodyClassName="space-y-2.5 pr-1"
      footer={<LayerTargetToggle value={target} onChange={onTargetChange} />}
    >
      <AdjustmentSliders
        adjustments={grade.adjustments}
        commit={grade.commit}
        preview={grade.preview}
      />
      {target === "backdrop" ? (
        <>
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
        </>
      ) : null}
    </BackdropControlPopover>
  )
}
