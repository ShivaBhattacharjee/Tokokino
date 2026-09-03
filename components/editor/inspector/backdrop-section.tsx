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
  clearTrackedLivePreviewVars,
  createLivePreviewVarWrites,
  livePreviewRoots,
  setLivePreviewVar,
  writeTrackedLivePreviewVars,
} from "@/lib/editor/live-preview-vars"
import {
  isNeutralMediaAdjustments,
  MAIN_MEDIA_FX_PREVIEW_VAR,
  mediaFilterCss,
  NEUTRAL_MEDIA_ADJUSTMENTS,
  slotMediaFxPreviewVar,
} from "@/lib/editor/css-utils"
import {
  DEFAULT_BACKDROP_ASCII,
  isWebKitEngine,
  resolveBackdropAscii,
  setAsciiResolutionPreview,
} from "@/lib/editor/ascii-backdrop"
import { isVideoSrc } from "@/lib/editor/media-type"
import { useScreenshotStyleTarget } from "@/lib/editor/screenshot-style-target"
import {
  resolveMainScreenshotStyle,
  resolveSlotScreenshotStyle,
} from "@/lib/editor/store/canvas-helpers"
import type { AssetFilter, MediaAdjustments } from "@/lib/editor/state-types"
import { cn } from "@/lib/utils"

import {
  BACKDROP_FX_PREVIEW_VAR,
  BACKDROP_NOISE_PREVIEW_VAR,
  lightingPatch,
  type BackdropControlId,
  type BackdropLayerTarget,
  type BackdropPickerLayout,
} from "./backdrop-section-parts/constants"
import type { LayerGrade } from "./backdrop-section-parts/layer-grade"
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
  const enhance = useActiveCanvasField((c) => c.enhance)
  const slotIds = useActiveCanvasField((c) =>
    c.screenshotSlots.map((slot) => slot.id).join(",")
  )
  const {
    applyStyle,
    selectedSlot,
    target: styleTarget,
  } = useScreenshotStyleTarget()
  const mediaStyle = useActiveCanvasField((canvas) =>
    selectedSlot
      ? resolveSlotScreenshotStyle(selectedSlot, canvas)
      : resolveMainScreenshotStyle(canvas)
  )
  const isVideoMedia = useActiveCanvasField((canvas) =>
    isVideoSrc(selectedSlot ? selectedSlot.src : canvas.screenshot)
  )
  const mediaLabel = isVideoMedia ? "Video" : "Screenshot"
  const activeCanvasId = useActiveCanvasId()
  const setBackdropEffects = useEditorStore((s) => s.setBackdropEffects)
  const setBackdropPattern = useEditorStore((s) => s.setBackdropPattern)
  const setBackdropFilter = useEditorStore((s) => s.setBackdropFilter)
  const setBackdropAscii = useEditorStore((s) => s.setBackdropAscii)
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
  // ASCII resolution can't preview through a CSS var: the glyph grid has to be
  // resampled to change. Safari took ~45ms per image readback at 200 columns,
  // so repeating it for every pointermove blocks the main thread. WebKit keeps
  // the slider/value responsive and performs the real resample once on commit;
  // Chromium keeps the live grid preview that it can render cheaply.
  const previewAsciiResolution = React.useCallback(
    (resolution: number | null) => {
      if (resolution !== null && isWebKitEngine()) return
      setAsciiResolutionPreview(activeCanvasId, resolution)
    },
    [activeCanvasId]
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

  // Which boxes a media-grade drag previews on has to match which boxes the
  // commit will touch, so the preview vars come from the same style target.
  const mediaFxVars = React.useMemo(() => {
    if (styleTarget === "slot" && selectedSlot) {
      return [slotMediaFxPreviewVar(selectedSlot.id)]
    }
    if (styleTarget === "main") return [MAIN_MEDIA_FX_PREVIEW_VAR]
    return [
      MAIN_MEDIA_FX_PREVIEW_VAR,
      ...slotIds
        .split(",")
        .filter(Boolean)
        .map((id) => slotMediaFxPreviewVar(id)),
    ]
  }, [selectedSlot, slotIds, styleTarget])
  // Cleanup undoes the writes this drag actually made rather than re-deriving
  // them: the targets follow the selection, so a canvas/selection change
  // mid-drag would otherwise strand a preview filter on the boxes it started on.
  const mediaFxWrites = React.useRef(createLivePreviewVarWrites())
  const clearMediaFxPreview = React.useCallback(() => {
    clearTrackedLivePreviewVars(mediaFxWrites.current)
  }, [])
  // Unmounting mid-drag (switching inspector tab / mobile category) leaves the
  // canvas up, so an uncleared var would keep overriding the committed grade.
  React.useEffect(() => clearMediaFxPreview, [clearMediaFxPreview])
  const commitMediaAdjustments = React.useCallback(
    (patch: Partial<MediaAdjustments>) => {
      applyStyle({ adjustments: { ...mediaStyle.adjustments, ...patch } })
      if (typeof requestAnimationFrame === "undefined") {
        clearMediaFxPreview()
        return
      }
      requestAnimationFrame(clearMediaFxPreview)
    },
    [applyStyle, clearMediaFxPreview, mediaStyle.adjustments]
  )
  const previewMediaAdjustments = React.useCallback(
    (patch: Partial<MediaAdjustments>) => {
      const candidate = { ...mediaStyle.adjustments, ...patch }
      writeTrackedLivePreviewVars(
        mediaFxWrites.current,
        livePreviewRoots(activeCanvasId),
        mediaFxVars,
        mediaFilterCss({
          enhance,
          filter: mediaStyle.filter,
          adjustments: candidate,
        }) || "brightness(1)"
      )
    },
    [
      activeCanvasId,
      enhance,
      mediaFxVars,
      mediaStyle.adjustments,
      mediaStyle.filter,
    ]
  )
  const setMediaFilter = React.useCallback(
    (next: AssetFilter) => applyStyle({ filter: next }),
    [applyStyle]
  )

  const ascii = React.useMemo(
    () => resolveBackdropAscii(backdrop.ascii),
    [backdrop.ascii]
  )
  const setAscii = React.useCallback(
    (patch: Partial<typeof ascii>) => setBackdropAscii({ ...ascii, ...patch }),
    [ascii, setBackdropAscii]
  )

  const setPattern = React.useCallback(
    (patch: Partial<typeof pattern>) =>
      setBackdropPattern({ ...pattern, ...patch }),
    [pattern, setBackdropPattern]
  )
  const applyLighting = React.useCallback(
    (nextLighting: typeof lighting) => {
      applyStyle({ lighting: nextLighting })
    },
    [applyStyle]
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
  // Effects and Filters each remember their own layer choice, so grading the
  // backdrop doesn't move the filter picker off the screenshot and back.
  const [effectsTarget, setEffectsTarget] =
    React.useState<BackdropLayerTarget>("backdrop")
  const [filtersTarget, setFiltersTarget] =
    React.useState<BackdropLayerTarget>("backdrop")
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

  const backdropGrade: LayerGrade = {
    adjustments: effects,
    commit: commitEffects,
    preview: previewEffects,
    dirty:
      !isNeutralMediaAdjustments(effects) ||
      effects.noise !== 0 ||
      effects.opacity !== 100,
    reset: () =>
      setBackdropEffects({
        ...NEUTRAL_MEDIA_ADJUSTMENTS,
        noise: 0,
        opacity: 100,
      }),
  }
  const mediaGrade: LayerGrade = {
    adjustments: mediaStyle.adjustments,
    commit: commitMediaAdjustments,
    preview: previewMediaAdjustments,
    dirty: !isNeutralMediaAdjustments(mediaStyle.adjustments),
    reset: () => applyStyle({ adjustments: { ...NEUTRAL_MEDIA_ADJUSTMENTS } }),
  }
  const effectsGrade = effectsTarget === "backdrop" ? backdropGrade : mediaGrade
  const overlayActive = overlay.id !== null
  const patternActive = pattern.ids.length > 0
  const asciiActive = ascii.enabled
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
            target={effectsTarget}
            onTargetChange={setEffectsTarget}
            mediaLabel={mediaLabel}
            grade={effectsGrade}
            effects={effects}
            onOpenChange={handleInlineControlOpenChange("effects")}
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
            ascii={ascii}
            asciiActive={asciiActive}
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("pattern")}
            onResetPattern={() =>
              setBackdropPattern({
                ids: [],
                intensity: 50,
                thickness: 1,
                color: "#FFFFFF",
              })
            }
            onResetAscii={() => setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII })}
            setPattern={setPattern}
            setAscii={setAscii}
            setPreviewVar={setPreviewVar}
            clearPreviewVarAfterPaint={clearPreviewVarAfterPaint}
            previewAsciiResolution={previewAsciiResolution}
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
            target={filtersTarget}
            onTargetChange={setFiltersTarget}
            mediaLabel={mediaLabel}
            filter={
              filtersTarget === "backdrop" ? backdropFilter : mediaStyle.filter
            }
            pickerLayout={pickerLayout}
            onOpenChange={handleInlineControlOpenChange("filters")}
            onReset={() =>
              filtersTarget === "backdrop"
                ? setBackdropFilter("none")
                : setMediaFilter("none")
            }
            setFilter={
              filtersTarget === "backdrop" ? setBackdropFilter : setMediaFilter
            }
          />
        ) : null}
      </div>
    </div>
  )
}
