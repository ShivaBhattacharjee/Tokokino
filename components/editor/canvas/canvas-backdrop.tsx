"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
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
}

function CanvasBackdropImpl({
  background,
  backdrop,
  effectsFilter,
  noiseEnabled,
  noiseOpacity,
  portrait,
  overlay,
}: CanvasBackdropProps) {
  const effectiveBackground: Background = React.useMemo(() => {
    if (background.type !== "image") return background
    // Already a downscaled data URL — use it directly (fast GPU texture)
    if (background.value.startsWith("data:")) return background
    // sourceUrl is set: show thumb while the client downscale is in-flight
    if (background.sourceUrl) {
      if (background.thumbUrl && !background.thumbUrl.startsWith("data:")) {
        return { ...background, value: background.thumbUrl }
      }
      return background
    }
    const previewUrl = remoteImagePreviewUrl(background.value)
    return previewUrl ? { ...background, value: previewUrl } : background
  }, [background])

  const portraitStyle = portraitOverlayCss(
    portrait.mode,
    portrait.intensity,
    portrait.position,
    portrait.distance
  )
  const outerLightingStyle =
    backdrop.lighting.target === "outer"
      ? lightingOverlayCss(backdrop.lighting)
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
            // Animate-mode crossfade: AnimationLayer ramps this 0 → 1 so the
            // background softly fades in with the clip. Default 1 everywhere else.
            opacity: "var(--canvas-bg-opacity, 1)" as unknown as number,
          }}
        />

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
