"use client"

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

import { NOISE_DATA_URL, portraitOverlayCss } from "./helpers"

type CanvasBackdropProps = {
  background: Background
  backdrop: Backdrop
  effectsFilter: string | undefined
  noiseEnabled: boolean
  noiseOpacity: number
  portrait: Portrait
  overlay: Overlay
}

export function CanvasBackdrop({
  background,
  backdrop,
  effectsFilter,
  noiseEnabled,
  noiseOpacity,
  portrait,
  overlay,
}: CanvasBackdropProps) {
  const portraitStyle = portraitOverlayCss(portrait.mode, portrait.intensity)

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          background.type === "none" && "bg-transparency-checker"
        )}
        style={{
          ...backgroundCss(background),
          filter:
            [effectsFilter, assetFilterCss(backdrop.filter ?? "none")]
              .filter(Boolean)
              .join(" ") || undefined,
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
            opacity: backdrop.pattern.intensity / 100,
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

      {portraitStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={portraitStyle}
        />
      ) : null}

      {overlay.id !== null && overlay.position === "underlay" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("${overlayUrl(overlay.id)}")`,
            opacity: overlay.opacity / 100,
          }}
        />
      ) : null}
    </>
  )
}
