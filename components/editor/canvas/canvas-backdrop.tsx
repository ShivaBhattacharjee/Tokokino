"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  backgroundLayerOpacityVar,
  type AnimateBgStack,
} from "@/lib/editor/animation-playback"
import {
  assetFilterCss,
  backgroundCss,
  overlayUrl,
  patternCssFor,
  type Backdrop,
  type Background,
  type Overlay,
  type Portrait,
} from "@/lib/editor/store"
import { remoteImagePreviewUrl } from "@/lib/editor/image-resize"

/** Stable empty layer list so the memo deps don't change every render. */
const EMPTY_BG_LAYERS: AnimateBgStack["layers"] = []

import {
  lightingOverlayCss,
  NOISE_DATA_URL,
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
   * Animate mode only: a clip animates lighting, so the outer overlay mounts
   * even when it isn't the committed target (and even at zero intensity) so the
   * player can crossfade the glow onto it. See `lightingOverlayCss`.
   */
  lightingAnimated?: boolean
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
  lightingAnimated = false,
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
  const outerLightingStyle =
    backdrop.lighting.target === "outer" || lightingAnimated
      ? lightingOverlayCss(backdrop.lighting, {
          active: backdrop.lighting.target === "outer",
          forceMount: lightingAnimated,
        })
      : null

  const assetFilter = assetFilterCss(backdrop.filter ?? "none")
  const filterValue = React.useMemo(() => {
    if (!effectsFilter && !assetFilter) return undefined
    if (!assetFilter) return `var(--bd-fx-preview, ${effectsFilter})`
    if (!effectsFilter) return assetFilter
    return `var(--bd-fx-preview, ${effectsFilter}) ${assetFilter}`
  }, [assetFilter, effectsFilter])

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
        {hasBgStack ? (
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

        {backdrop.pattern.ids.map((id) => (
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
        ))}

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

      {portraitStyle ? (
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

      {overlay.id !== null && overlay.position === "underlay" ? (
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
