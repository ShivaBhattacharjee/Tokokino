"use client"

import { MobileAspectPicker } from "@/components/editor/aspect-popover"
import { LayersPanelContent } from "@/components/editor/layers-popover"
import { PresentPresetsSection } from "@/components/editor/present-presets-section"
import { BackdropSection } from "@/components/editor/inspector/backdrop-section"
import { BackgroundSection } from "@/components/editor/inspector/background-section"
import { BorderSection } from "@/components/editor/inspector/border-section"
import { PaddingSection } from "@/components/editor/inspector/padding-section"
import { ShadowSection } from "@/components/editor/inspector/shadow-section"
import { TiltSection } from "@/components/editor/inspector/tilt-section"
import type { AspectState } from "@/lib/editor/store"

import type { CategoryId } from "./categories"
import { MobileEnhancePanel } from "./enhance-panel"
import { MobileFitPanel } from "./fit-panel"
import { MobileMovePanel } from "./move-panel"

export function InlineOptions({
  id,
  aspect,
  onAspectChange,
  onClose,
}: {
  id: CategoryId
  aspect: AspectState
  onAspectChange: (id: string, custom?: { w: number; h: number }) => void
  onClose: () => void
}) {
  if (id === "aspect") {
    return (
      <MobileAspectPicker
        value={aspect.id}
        onChange={onAspectChange}
        onClose={onClose}
      />
    )
  }

  if (id === "layout") {
    return <PresentPresetsSection flat horizontal showPresetHeading={false} />
  }

  if (id === "layers") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <LayersPanelContent flat />
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 pb-6">
      <div>
        {id === "fit" ? <MobileFitPanel /> : null}
        {id === "move" ? <MobileMovePanel /> : null}
        {id === "enhance" ? <MobileEnhancePanel /> : null}
        {id === "background" ? <BackgroundSection flat /> : null}
        {id === "backdrop" ? <BackdropSection popoverSide="top" /> : null}
        {id === "border" ? <BorderSection /> : null}
        {id === "padding" ? <PaddingSection /> : null}
        {id === "shadow" ? <ShadowSection /> : null}
        {id === "transform" ? <TiltSection /> : null}
      </div>
    </div>
  )
}
