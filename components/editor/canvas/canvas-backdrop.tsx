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

import { lightingOverlayCss, NOISE_DATA_URL, portraitOverlayCss } from "./helpers"

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
    if (background.sourceUrl || background.value === background.thumbUrl) {
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
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          background.type === "none" && "bg-transparency-checker"
        )}
        style={{
          ...backgroundCss(effectiveBackground),
          ...(filterValue ? { filter: filterValue } : {}),
        }}
      />

      {backdrop.pattern.ids.map((id) => (
        <div
          key={id}
          aria-hidden
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

      {noiseEnabled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{ backgroundImage: NOISE_DATA_URL, opacity: noiseOpacity }}
        />
      ) : null}

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
