"use client"

import * as React from "react"

import {
  OVERLAY_COUNT,
  dynamicPatternColors,
  effectsFilterCss,
  sampleImageColors,
  useActiveCanvasField,
  useActiveCanvasId,
  useEditorStore,
} from "@/lib/editor/store"
import {
  livePreviewRoots,
  setLivePreviewVar,
} from "@/lib/editor/live-preview-roots"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import { cn } from "@/lib/utils"

import {
  BACKDROP_FX_PREVIEW_VAR,
  BACKDROP_NOISE_PREVIEW_VAR,
  lightingPatch,
  type BackdropControlId,
  type BackdropPickerLayout,
} from "./backdrop-section-parts/constants"
import { EffectsControl } from "./backdrop-section-parts/effects-control"
import { FiltersControl } from "./backdrop-section-parts/filters-control"
import { LightingControl } from "./backdrop-section-parts/lighting-control"
import { OverlayControl } from "./backdrop-section-parts/overlay-control"
import { PatternControl } from "./backdrop-section-parts/pattern-control"
import { PortraitControl } from "./backdrop-section-parts/portrait-control"
import { EffectSlider } from "./effect-slider"

export function BackdropSection({
  popoverSide = "left",
  controlsVariant = "popover",
}: {
  popoverSide?: "left" | "top"
  controlsVariant?: "popover" | "inline"
} = {}) {
  const backdrop = useActiveCanvasField((c) => c.backdrop)
  const background = useActiveCanvasField((c) => c.background)
  const overlay = useActiveCanvasField((c) => c.overlay)
  const portrait = useActiveCanvasField((c) => c.portrait)
  const canvasBorderRadius = useActiveCanvasField((c) => c.canvasBorderRadius)
  const { applyStyle, selectedSlot } = useScreenshotStyleTarget()
  const activeCanvasId = useActiveCanvasId()
  const setBackdropEffects = useEditorStore((s) => s.setBackdropEffects)
  const setBackdropPattern = useEditorStore((s) => s.setBackdropPattern)
  const setBackdropLighting = useEditorStore((s) => s.setBackdropLighting)
  const setMainScreenshotBackdropLighting = useEditorStore(
    (s) => s.setMainScreenshotBackdropLighting
  )
  const setBackdropFilter = useEditorStore((s) => s.setBackdropFilter)
  const setOverlay = useEditorStore((s) => s.setOverlay)
  const setPortrait = useEditorStore((s) => s.setPortrait)
  const setCanvasBorderRadius = useEditorStore((s) => s.setCanvasBorderRadius)
  const {
    effects,
    pattern,
    lighting,
    filter: backdropFilter = "none",
  } = backdrop
  const activeLighting = selectedSlot?.lighting ?? lighting

  // Live-preview CSS vars on the active canvas and every preset thumbnail
  // mirroring it: dragging sliders writes to these vars directly so both
  // update without re-rendering the store until the user releases the slider.
  // See tilt-section.tsx for the same pattern applied to tilt/scale.
  const setPreviewVar = React.useCallback(
    (name: string, value: string | null) => {
      setLivePreviewVar(livePreviewRoots(activeCanvasId), name, value)
    },
    [activeCanvasId]
  )
  const clearPreviewVarAfterPaint = React.useCallback(
    (name: string) => {
      if (typeof requestAnimationFrame === "undefined") return
      requestAnimationFrame(() => setPreviewVar(name, null))
    },
    [setPreviewVar]
  )
  const [imageColors, setImageColors] = React.useState<string[] | null>(null)

  const isImageBackground = background.type === "image"

  React.useEffect(() => {
    if (!isImageBackground) return
    const colorSampleUrl = background.thumbUrl ?? background.value
    let cancelled = false
    sampleImageColors(colorSampleUrl)
      .then((cs) => {
        if (!cancelled) setImageColors(cs.length ? cs : null)
      })
      .catch(() => {
        if (!cancelled) setImageColors(null)
      })
    return () => {
      cancelled = true
    }
  }, [isImageBackground, background.thumbUrl, background.value])

  const patternColors = React.useMemo(() => {
    if (isImageBackground && imageColors?.length) return imageColors
    return dynamicPatternColors(background)
  }, [background, isImageBackground, imageColors])

  const commitEffects = React.useCallback(
    (patch: Partial<typeof effects>) => {
      setBackdropEffects({ ...effects, ...patch })
      clearPreviewVarAfterPaint(BACKDROP_FX_PREVIEW_VAR)
      clearPreviewVarAfterPaint(BACKDROP_NOISE_PREVIEW_VAR)
    },
    [clearPreviewVarAfterPaint, effects, setBackdropEffects]
  )
  const previewEffects = React.useCallback(
    (patch: Partial<typeof effects>) => {
      const candidate = { ...effects, ...patch }
      // A neutral candidate must still write the var — clearing it would fall
      // back to the committed (non-neutral) filter while the slider sits at its
      // neutral value.
      setPreviewVar(
        BACKDROP_FX_PREVIEW_VAR,
        effectsFilterCss(candidate) ?? "brightness(1)"
      )
      if (patch.noise !== undefined) {
        setPreviewVar(
          BACKDROP_NOISE_PREVIEW_VAR,
          `${Math.max(0, Math.min(100, candidate.noise)) / 100}`
        )
      }
    },
    [effects, setPreviewVar]
  )
  const setPattern = React.useCallback(
    (patch: Partial<typeof pattern>) =>
      setBackdropPattern({ ...pattern, ...patch }),
    [pattern, setBackdropPattern]
  )
  const applyLighting = React.useCallback(
    (nextLighting: typeof lighting) => {
      applyStyle(
        { lighting: nextLighting },
        () => setMainScreenshotBackdropLighting(nextLighting),
        () => setBackdropLighting(nextLighting)
      )
    },
    [applyStyle, setBackdropLighting, setMainScreenshotBackdropLighting]
  )
  const setLighting = React.useCallback(
    (patch: Partial<typeof lighting>) =>
      applyLighting(lightingPatch(activeLighting, patch)),
    [activeLighting, applyLighting]
  )
  const overlayRef = React.useRef(overlay)
  React.useEffect(() => {
    overlayRef.current = overlay
  })
  const setOverlayPatch = React.useCallback(
    (patch: Partial<typeof overlay>) =>
      setOverlay({ ...overlayRef.current, ...patch }),
    [setOverlay]
  )

  const overlayIds = React.useMemo(
    () => Array.from({ length: OVERLAY_COUNT }, (_, i) => i + 1),
    []
  )

  const [overlayPopoverOpen, setOverlayPopoverOpen] = React.useState(false)
  const [overlayHasOpened, setOverlayHasOpened] = React.useState(false)
  const [inlineControl, setInlineControl] =
    React.useState<BackdropControlId | null>(null)
  const usesInlineControls = controlsVariant === "inline"
  const handleInlineControlOpenChange = React.useCallback(
    (id: BackdropControlId) => (open: boolean) => {
      setInlineControl(open ? id : null)
    },
    []
  )
  const handleOverlayOpenChange = React.useCallback((open: boolean) => {
    setOverlayPopoverOpen(open)
    if (open) setOverlayHasOpened(true)
  }, [])
  const handleOverlayControlOpenChange = React.useCallback(
    (open: boolean) => {
      if (usesInlineControls) {
        setInlineControl(open ? "overlay" : null)
        if (open) setOverlayHasOpened(true)
        return
      }
      handleOverlayOpenChange(open)
    },
    [handleOverlayOpenChange, usesInlineControls]
  )

  const effectsDirty =
    effects.brightness !== 100 ||
    effects.contrast !== 100 ||
    effects.saturation !== 100 ||
    effects.hue !== 0 ||
    effects.grayscale !== 0 ||
    effects.sepia !== 0 ||
    effects.invert !== 0 ||
    effects.blur !== 0 ||
    effects.noise !== 0 ||
    effects.opacity !== 100
  const overlayActive = overlay.id !== null
  const patternActive = pattern.ids.length > 0
  const portraitActive = portrait.mode !== "off"
  const lightingActive = activeLighting.intensity > 0
  const shouldRenderControl = React.useCallback(
    (id: BackdropControlId) =>
      !usesInlineControls || inlineControl === null || inlineControl === id,
    [inlineControl, usesInlineControls]
  )
  const isInlineDrillIn = usesInlineControls && inlineControl !== null
  const pickerLayout: BackdropPickerLayout = usesInlineControls
    ? "carousel"
    : "grid"

  return (
    <div
      className={cn("flex flex-col gap-4", isInlineDrillIn && "min-h-0 gap-0")}
    >
      {isInlineDrillIn ? null : (
        <div className="pt-1">
          <EffectSlider
            label="Canvas Radius"
            value={canvasBorderRadius}
            onChange={(v) => {
              setCanvasBorderRadius(v)
              clearPreviewVarAfterPaint("--canvas-bd-radius")
            }}
            onPreview={(v) => setPreviewVar("--canvas-bd-radius", `${v}px`)}
            max={80}
          />
        </div>
      )}

      <div
        className={cn("grid grid-cols-3 gap-2", isInlineDrillIn && "min-h-0")}
      >
        {shouldRenderControl("overlay") ? (
          <OverlayControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "overlay"}
            overlay={overlay}
            overlayIds={overlayIds}
            overlayActive={overlayActive}
            overlayPopoverOpen={overlayPopoverOpen}
            overlayHasOpened={overlayHasOpened}
            pickerLayout={pickerLayout}
            onOpenChange={handleOverlayControlOpenChange}
            onReset={() =>
              setOverlay({ id: null, opacity: 50, position: "overlay" })
            }
            setOverlayPatch={setOverlayPatch}
            setPreviewVar={setPreviewVar}
            clearPreviewVarAfterPaint={clearPreviewVarAfterPaint}
          />
        ) : null}

        {shouldRenderControl("lighting") ? (
          <LightingControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "lighting"}
            activeLighting={activeLighting}
            lightingActive={lightingActive}
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("lighting")}
            onReset={() =>
              applyLighting({
                target: "inner",
                intensity: 0,
                direction: "0-0",
                color: "#FFFFFF",
              })
            }
            setLighting={setLighting}
          />
        ) : null}

        {shouldRenderControl("effects") ? (
          <EffectsControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "effects"}
            effects={effects}
            effectsDirty={effectsDirty}
            onOpenChange={handleInlineControlOpenChange("effects")}
            onReset={() =>
              setBackdropEffects({
                noise: 0,
                blur: 0,
                brightness: 100,
                contrast: 100,
                saturation: 100,
                hue: 0,
                grayscale: 0,
                sepia: 0,
                invert: 0,
                opacity: 100,
              })
            }
            commitEffects={commitEffects}
            previewEffects={previewEffects}
          />
        ) : null}

        {shouldRenderControl("pattern") ? (
          <PatternControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "pattern"}
            pattern={pattern}
            patternActive={patternActive}
            patternColors={patternColors}
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("pattern")}
            onReset={() =>
              setBackdropPattern({
                ids: [],
                intensity: 50,
                thickness: 1,
                color: "#FFFFFF",
              })
            }
            setPattern={setPattern}
            setPreviewVar={setPreviewVar}
            clearPreviewVarAfterPaint={clearPreviewVarAfterPaint}
          />
        ) : null}

        {shouldRenderControl("portrait") ? (
          <PortraitControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "portrait"}
            portrait={portrait}
            portraitActive={portraitActive}
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("portrait")}
            onReset={() =>
              setPortrait({
                mode: "off",
                intensity: 60,
                position: 50,
                distance: 50,
              })
            }
            setPortrait={setPortrait}
          />
        ) : null}

        {shouldRenderControl("filters") ? (
          <FiltersControl
            popoverSide={popoverSide}
            controlsVariant={controlsVariant}
            usesInlineControls={usesInlineControls}
            inlineOpen={inlineControl === "filters"}
            backdropFilter={backdropFilter}
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("filters")}
            onReset={() => setBackdropFilter("none")}
            setBackdropFilter={setBackdropFilter}
          />
        ) : null}
      </div>
    </div>
  )
}
