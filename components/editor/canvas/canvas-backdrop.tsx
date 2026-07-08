"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  backgroundLayerOpacityVar,
  filterLayerOpacityVar,
  patternLayerOpacityVar,
  PATTERN_BASE_OPACITY_VAR,
  portraitLayerOpacityVar,
  PORTRAIT_BASE_OPACITY_VAR,
  overlayLayerOpacityVar,
  OVERLAY_BASE_OPACITY_VAR,
  type AnimateBgStack,
  type AnimateFilterStack,
  type AnimateOverlayStack,
  type AnimatePatternStack,
  type AnimatePortraitStack,
} from "@/lib/editor/animation-playback"
import {
  assetFilterCss,
  backgroundCss,
  overlayUrl,
  patternCssFor,
  type AssetFilter,
  type Backdrop,
  type BackdropPattern,
  type Background,
  type Overlay,
  type Portrait,
} from "@/lib/editor/store"
import { remoteImagePreviewUrl } from "@/lib/editor/image-resize"

/** Stable empty layer list so the memo deps don't change every render. */
const EMPTY_BG_LAYERS: AnimateBgStack["layers"] = []
const EMPTY_FILTER_LAYERS: AnimateFilterStack["layers"] = []
const EMPTY_PORTRAIT_LAYERS: AnimatePortraitStack["layers"] = []
const EMPTY_PATTERN_LAYERS: AnimatePatternStack["layers"] = []
const EMPTY_OVERLAY_LAYERS: AnimateOverlayStack["layers"] = []

import {
  lightingOverlayCss,
  NOISE_DATA_URL,
  overlayLayerCss,
  portraitOverlayCss,
} from "./helpers"

type CanvasBackdropProps = {
  background: Background
  backdrop: Backdrop
  effectsFilter: string | undefined
  noiseEnabled: boolean
  noiseOpacity: number
  portrait: Portrait
  overlay: Overlay
  /**
   * Animate mode only: one stacked background layer per background keyframe (plus
   * the pre-first-keyframe base) so multiple background swaps chain bg1 → bg2 →
   * bg3. Empty stack → just the committed background renders (default).
   */
  animateBgStack?: AnimateBgStack
  /**
   * Animate mode only: one stacked layer per FILTER keyframe (plus the pre-first
   * base) so multiple filter changes chain f1 → f2 → f3, each cross-fading over
   * the one beneath — the exact mirror of `animateBgStack`. Each layer is the
   * committed background rendered with that keyframe's filter. Empty → the
   * committed filter renders as usual.
   */
  animateFilterStack?: AnimateFilterStack
  /**
   * Animate mode only: one overlay per PORTRAIT keyframe (plus the pre-first
   * base), crossfade-chained by AnimationLayer (each fades in then back out as
   * the next fades in) so the additive vignettes transition instead of stacking.
   * Empty → the committed portrait renders as usual.
   */
  animatePortraitStack?: AnimatePortraitStack
  /**
   * Animate mode only: one group of pattern overlays per PATTERN keyframe (plus
   * the pre-first base), crossfade-chained like the portrait stack so additive
   * pattern textures transition instead of accumulating. Empty → the committed
   * pattern renders as usual.
   */
  animatePatternStack?: AnimatePatternStack
  /**
   * Animate mode only: one texture-overlay layer per OVERLAY keyframe (plus the
   * pre-first base), crossfade-chained like the portrait/pattern stacks so the
   * additive textures transition instead of accumulating. Each layer renders in
   * ITS position (over vs under the screenshot); this component renders the
   * `underlay` ones, canvas-view renders the `overlay` ones. Empty → the
   * committed overlay renders as usual.
   */
  animateOverlayStack?: AnimateOverlayStack
  /**
   * Animate mode only: a clip animates lighting, so the outer overlay mounts
   * even when it isn't the committed target (and even at zero intensity) so the
   * player can crossfade the glow onto it. See `lightingOverlayCss`.
   */
  lightingAnimated?: boolean
  /**
   * Animate mode only: a clip animates backdrop effects, so the backdrop layers
   * always carry the `--bd-fx-preview` filter var (falling back to `none`) even
   * when the committed effects are neutral — so an effect can ease in from / out
   * to nothing.
   */
  backdropAnimated?: boolean
}

function CanvasBackdropImpl({
  background,
  backdrop,
  effectsFilter,
  noiseEnabled,
  noiseOpacity,
  portrait,
  overlay,
  animateBgStack,
  animateFilterStack,
  animatePortraitStack,
  animatePatternStack,
  animateOverlayStack,
  lightingAnimated = false,
  backdropAnimated = false,
}: CanvasBackdropProps) {
  const resolveEffectiveBackground = React.useCallback(
    (bg: Background): Background => {
      if (bg.type !== "image") return bg
      // Already a downscaled data URL — use it directly (fast GPU texture)
      if (bg.value.startsWith("data:")) return bg
      // sourceUrl is set: show thumb while the client downscale is in-flight
      if (bg.sourceUrl) {
        if (bg.thumbUrl && !bg.thumbUrl.startsWith("data:")) {
          return { ...bg, value: bg.thumbUrl }
        }
        return bg
      }
      const previewUrl = remoteImagePreviewUrl(bg.value)
      return previewUrl ? { ...bg, value: previewUrl } : bg
    },
    []
  )
  const effectiveBackground = React.useMemo(
    () => resolveEffectiveBackground(background),
    [resolveEffectiveBackground, background]
  )
  const bgStackBase = animateBgStack?.base ?? null
  const bgLayers = animateBgStack?.layers ?? EMPTY_BG_LAYERS
  const hasBgStack = bgLayers.length > 0
  const effectiveBgBase = React.useMemo(
    () => (bgStackBase ? resolveEffectiveBackground(bgStackBase) : null),
    [resolveEffectiveBackground, bgStackBase]
  )
  const effectiveBgLayers = React.useMemo(
    () =>
      bgLayers.map((layer) => ({
        ...layer,
        background: resolveEffectiveBackground(layer.background),
      })),
    [resolveEffectiveBackground, bgLayers]
  )

  const portraitStyle = portraitOverlayCss(
    portrait.mode,
    portrait.intensity,
    portrait.position,
    portrait.distance
  )
  // Build a portrait overlay style for a given portrait state (blur/stage sit on
  // top via a raised z-index, matching the committed render). Returns null when
  // the portrait is "off" (no overlay).
  const portraitLayerStyle = React.useCallback(
    (p: Portrait): React.CSSProperties | null => {
      const style = portraitOverlayCss(
        p.mode,
        p.intensity,
        p.position,
        p.distance
      )
      if (!style) return null
      return p.mode === "blur" || p.mode === "stage"
        ? { ...style, zIndex: 200 }
        : style
    },
    []
  )
  const portraitLayers = animatePortraitStack?.layers ?? EMPTY_PORTRAIT_LAYERS
  const hasPortraitStack = portraitLayers.length > 0
  const portraitBaseStyle = animatePortraitStack
    ? portraitLayerStyle(animatePortraitStack.base)
    : null
  const outerLightingStyle =
    backdrop.lighting.target === "outer" || lightingAnimated
      ? lightingOverlayCss(backdrop.lighting, {
          active: backdrop.lighting.target === "outer",
          forceMount: lightingAnimated,
        })
      : null

  // Combine the (possibly animated) backdrop-effects filter with a given asset
  // filter preset into one CSS `filter`. While a clip animates backdrop effects
  // the var must always be read, even when the committed effects are neutral —
  // fall back to `none` so the layer still carries the filter for the player.
  const filterCssFor = React.useCallback(
    (assetFilterId: AssetFilter): string | undefined => {
      const fx = effectsFilter ?? (backdropAnimated ? "none" : undefined)
      const fxPart = fx ? `var(--bd-fx-preview, ${fx})` : undefined
      const af = assetFilterCss(assetFilterId)
      if (fxPart && af) return `${fxPart} ${af}`
      return fxPart ?? af ?? undefined
    },
    [effectsFilter, backdropAnimated]
  )
  const filterValue = filterCssFor(backdrop.filter ?? "none")

  const filterStackBase = animateFilterStack?.base ?? "none"
  const filterLayers = animateFilterStack?.layers ?? EMPTY_FILTER_LAYERS
  const hasFilterStack = filterLayers.length > 0

  const patternLayers = animatePatternStack?.layers ?? EMPTY_PATTERN_LAYERS
  const hasPatternStack = patternLayers.length > 0

  const overlayLayers = animateOverlayStack?.layers ?? EMPTY_OVERLAY_LAYERS
  const hasOverlayStack = overlayLayers.length > 0
  // Render the `underlay`-positioned layers of the overlay stack (canvas-view
  // handles `overlay`-positioned ones). Base renders here only if it sits under.
  const renderOverlayUnderlay = React.useCallback(() => {
    if (!animateOverlayStack) return null
    const base = animateOverlayStack.base
    const baseStyle =
      base.position === "underlay"
        ? overlayLayerCss(base, OVERLAY_BASE_OPACITY_VAR, 0)
        : null
    return (
      <>
        {baseStyle ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={baseStyle}
          />
        ) : null}
        {overlayLayers.map((layer) => {
          if (layer.overlay.position !== "underlay") return null
          const style = overlayLayerCss(
            layer.overlay,
            overlayLayerOpacityVar(layer.id),
            layer.restOpaque ? 1 : 0
          )
          if (!style) return null
          return (
            <div
              key={layer.id}
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={style}
            />
          )
        })}
      </>
    )
  }, [animateOverlayStack, overlayLayers])
  // Render one overlay div per id in a pattern, its opacity = the layer's
  // crossfade opacity (var) × the pattern's own intensity. `keyId` namespaces
  // the divs so React keys stay unique across layers.
  const renderPatternGroup = React.useCallback(
    (pattern: BackdropPattern, opacityVar: string, restOpaque: number) => {
      const intensity = Math.max(0, Math.min(100, pattern.intensity)) / 100
      return pattern.ids.map((id) => (
        <div
          key={`${opacityVar}:${id}`}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            ...patternCssFor(id, pattern.color, pattern.thickness),
            opacity:
              `calc(var(${opacityVar}, ${restOpaque}) * ${intensity})` as unknown as number,
          }}
        />
      ))
    },
    []
  )

  return (
    <>
      {/*
        Background + patterns + noise form the blend group: the noise layer uses
        mix-blend-overlay and only ever needs to blend against these siblings.
        `isolation: isolate` contains that blend in its own stacking context so
        it flattens to a single rasterized layer. Without this, the blend mode
        leaks into the canvas stacking context and forces the browser to
        CPU-repaint any element dragged over the backdrop (text/assets) instead
        of compositing it on the GPU — the cause of the edge-drag jank.
      */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ isolation: "isolate" }}
      >
        {hasFilterStack ? (
          // Animate mode with animated filter(s): the committed background is
          // rendered once per FILTER keyframe (chronological, bottom → top) over
          // a base (the filter before the first keyframe). AnimationLayer fades
          // each layer in at its keyframe so multiple filter changes chain, each
          // cross-fading over the one beneath — the mirror of the bg stack. At
          // rest each layer falls back to its rest opacity so the selected
          // keyframe's filter shows.
          <>
            <div
              aria-hidden
              className={cn(
                "absolute inset-0",
                effectiveBackground.type === "none" && "bg-transparency-checker"
              )}
              data-bg-source-url={
                effectiveBackground.type === "image" &&
                effectiveBackground.sourceUrl &&
                effectiveBackground.sourceUrl !== effectiveBackground.value
                  ? effectiveBackground.sourceUrl
                  : undefined
              }
              style={{
                ...backgroundCss(effectiveBackground),
                ...(filterCssFor(filterStackBase)
                  ? { filter: filterCssFor(filterStackBase) }
                  : {}),
              }}
            />
            {filterLayers.map((layer) => {
              const layerFilter = filterCssFor(layer.filter)
              return (
                <div
                  key={layer.id}
                  aria-hidden
                  className={cn(
                    "absolute inset-0",
                    effectiveBackground.type === "none" &&
                      "bg-transparency-checker"
                  )}
                  data-bg-source-url={
                    effectiveBackground.type === "image" &&
                    effectiveBackground.sourceUrl &&
                    effectiveBackground.sourceUrl !== effectiveBackground.value
                      ? effectiveBackground.sourceUrl
                      : undefined
                  }
                  style={{
                    ...backgroundCss(effectiveBackground),
                    ...(layerFilter ? { filter: layerFilter } : {}),
                    opacity: `var(${filterLayerOpacityVar(layer.id)}, ${
                      layer.restOpaque ? 1 : 0
                    })` as unknown as number,
                  }}
                />
              )
            })}
          </>
        ) : hasBgStack ? (
          // Animate mode with animated background(s): a stack of layers, one per
          // background keyframe (chronological, bottom → top), over an optional
          // base (the background before the first keyframe). AnimationLayer fades
          // each layer in at its keyframe so multiple swaps chain, each
          // cross-fading over the one beneath. At rest each layer falls back to
          // its rest opacity so the selected keyframe's background shows.
          <>
            {effectiveBgBase ? (
              <div
                aria-hidden
                className={cn(
                  "absolute inset-0",
                  effectiveBgBase.type === "none" && "bg-transparency-checker"
                )}
                data-bg-source-url={
                  effectiveBgBase.type === "image" &&
                  effectiveBgBase.sourceUrl &&
                  effectiveBgBase.sourceUrl !== effectiveBgBase.value
                    ? effectiveBgBase.sourceUrl
                    : undefined
                }
                style={{
                  ...backgroundCss(effectiveBgBase),
                  ...(filterValue ? { filter: filterValue } : {}),
                }}
              />
            ) : null}
            {effectiveBgLayers.map((layer) => (
              <div
                key={layer.id}
                aria-hidden
                className={cn(
                  "absolute inset-0",
                  layer.background.type === "none" && "bg-transparency-checker"
                )}
                data-bg-source-url={
                  layer.background.type === "image" &&
                  layer.background.sourceUrl &&
                  layer.background.sourceUrl !== layer.background.value
                    ? layer.background.sourceUrl
                    : undefined
                }
                style={{
                  ...backgroundCss(layer.background),
                  ...(filterValue ? { filter: filterValue } : {}),
                  opacity: `var(${backgroundLayerOpacityVar(layer.id)}, ${
                    layer.restOpaque ? 1 : 0
                  })` as unknown as number,
                }}
              />
            ))}
          </>
        ) : (
          <div
            className={cn(
              "absolute inset-0",
              background.type === "none" && "bg-transparency-checker"
            )}
            data-bg-source-url={
              background.type === "image" &&
              background.sourceUrl &&
              background.sourceUrl !== background.value
                ? background.sourceUrl
                : undefined
            }
            style={{
              ...backgroundCss(effectiveBackground),
              ...(filterValue ? { filter: filterValue } : {}),
            }}
          />
        )}

        {hasPatternStack ? (
          // Animate mode with animated pattern: base group + one group per
          // keyframe, crossfade-chained by AnimationLayer so the additive
          // textures transition instead of stacking. At rest only the selected
          // keyframe's group shows.
          <>
            {animatePatternStack
              ? renderPatternGroup(
                  animatePatternStack.base,
                  PATTERN_BASE_OPACITY_VAR,
                  0
                )
              : null}
            {patternLayers.map((layer) =>
              renderPatternGroup(
                layer.pattern,
                patternLayerOpacityVar(layer.id),
                layer.restOpaque ? 1 : 0
              )
            )}
          </>
        ) : (
          backdrop.pattern.ids.map((id) => (
            <div
              key={id}
              className="pointer-events-none absolute inset-0"
              style={{
                ...patternCssFor(
                  id,
                  backdrop.pattern.color,
                  backdrop.pattern.thickness
                ),
                opacity: `var(--bd-pattern-intensity, ${backdrop.pattern.intensity / 100})`,
              }}
            />
          ))
        )}

        <div
          data-noise-enabled={noiseEnabled ? "" : undefined}
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{
            backgroundImage: NOISE_DATA_URL,
            opacity: `var(--bd-noise-opacity, ${noiseOpacity})`,
          }}
        />
      </div>

      {outerLightingStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ ...outerLightingStyle, zIndex: 20 }}
        />
      ) : null}

      {hasPortraitStack ? (
        // Animate mode with animated portrait: base overlay + one per keyframe,
        // each opacity crossfade-chained by AnimationLayer so the vignettes
        // transition instead of accumulating. At rest only the selected shows.
        <>
          {portraitBaseStyle ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                ...portraitBaseStyle,
                opacity:
                  `var(${PORTRAIT_BASE_OPACITY_VAR}, 0)` as unknown as number,
              }}
            />
          ) : null}
          {portraitLayers.map((layer) => {
            const style = portraitLayerStyle(layer.portrait)
            if (!style) return null
            return (
              <div
                key={layer.id}
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  ...style,
                  opacity: `var(${portraitLayerOpacityVar(layer.id)}, ${
                    layer.restOpaque ? 1 : 0
                  })` as unknown as number,
                }}
              />
            )
          })}
        </>
      ) : portraitStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={
            portrait.mode === "blur" || portrait.mode === "stage"
              ? { ...portraitStyle, zIndex: 200 }
              : portraitStyle
          }
        />
      ) : null}

      {hasOverlayStack ? (
        renderOverlayUnderlay()
      ) : overlay.id !== null && overlay.position === "underlay" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("${overlayUrl(overlay.id)}")`,
            opacity: `var(--bd-overlay-opacity, ${overlay.opacity / 100})`,
          }}
        />
      ) : null}
    </>
  )
}

export const CanvasBackdrop = React.memo(CanvasBackdropImpl)
