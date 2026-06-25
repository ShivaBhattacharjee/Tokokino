import type * as React from "react"

import type {
  AssetFilter,
  BackdropLighting,
  PortraitMode,
} from "@/lib/editor/state-types"

export const PORTRAIT_MODES: { id: PortraitMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "soft", label: "Soft" },
  { id: "studio", label: "Studio" },
  { id: "spot", label: "Spot" },
  { id: "frame", label: "Frame" },
  { id: "iris", label: "Iris" },
  { id: "blur", label: "Blur" },
  { id: "stage", label: "Stage" },
]

export const LIGHTING_COLOR_PRESETS = [
  "#FFFFFF",
  "#DDF5FF",
  "#D8FFE4",
  "#FFE8BD",
  "#FFC7D6",
]

export const LIGHTING_DIRECTIONS = [
  { id: "0-0", label: "Top left" },
  { id: "0-2", label: "Top" },
  { id: "0-4", label: "Top right" },
  { id: "2-0", label: "Left" },
  { id: "center", label: "Center" },
  { id: "2-4", label: "Right" },
  { id: "4-0", label: "Bottom left" },
  { id: "4-2", label: "Bottom" },
  { id: "4-4", label: "Bottom right" },
]

export const BACKDROP_FX_PREVIEW_VAR = "--bd-fx-preview"
export const BACKDROP_NOISE_PREVIEW_VAR = "--bd-noise-opacity"
export const ACTIVE_COLOR_SWATCH_CLASS =
  "border-primary shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--primary)/0.9)]"

export type BackdropControlId =
  | "overlay"
  | "lighting"
  | "effects"
  | "pattern"
  | "portrait"
  | "filters"

export type BackdropPickerLayout = "grid" | "carousel"

export const BACKDROP_FILTERS: { id: AssetFilter; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "bw", label: "B&W" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "fade", label: "Fade" },
  { id: "vivid", label: "Vivid" },
  { id: "noir", label: "Noir" },
  { id: "dream", label: "Dream" },
  { id: "mono", label: "Mono" },
  { id: "invert", label: "Invert" },
]

export function portraitPreviewCss(mode: PortraitMode): React.CSSProperties {
  switch (mode) {
    case "off":
      return {
        background: "linear-gradient(135deg, oklch(0.32 0 0), oklch(0.18 0 0))",
      }
    case "soft":
      return {
        background:
          "radial-gradient(ellipse at 50% 50%, oklch(0.6 0 0) 0%, oklch(0.6 0 0) 30%, oklch(0.1 0 0) 100%)",
      }
    case "studio":
      return {
        background:
          "radial-gradient(ellipse 65% 55% at 50% 45%, oklch(0.78 0 0) 0%, oklch(0.6 0 0) 35%, oklch(0.05 0 0) 95%)",
      }
    case "spot":
      return {
        background:
          "radial-gradient(circle at 50% 45%, #fff 0%, oklch(0.7 0 0) 18%, oklch(0.05 0 0) 70%)",
      }
    case "frame":
      return {
        background: "linear-gradient(135deg, oklch(0.55 0 0), oklch(0.42 0 0))",
        boxShadow: "inset 0 0 18px 6px rgba(0,0,0,0.85)",
      }
    case "iris":
      return {
        background:
          "radial-gradient(circle at 50% 50%, oklch(0.7 0 0) 30%, #000 55%, #000 100%)",
      }
    case "blur":
      return {
        background: "linear-gradient(135deg, oklch(0.7 0 0), oklch(0.5 0 0))",
        filter: "blur(2px)",
      }
    case "stage":
      return {
        background:
          "radial-gradient(circle at 50% 45%, oklch(0.8 0 0) 0%, oklch(0.55 0 0) 12%, #000 38%, #000 100%)",
      }
    default:
      return {}
  }
}

export function lightingDirectionPreview(
  direction: string,
  color: string
): React.CSSProperties {
  const [rowRaw, colRaw] =
    direction === "center" ? [2, 2] : direction.split("-")
  const row = Number(rowRaw)
  const col = Number(colRaw)
  const x = Number.isFinite(col) ? Math.max(0, Math.min(4, col)) * 25 : 50
  const y = Number.isFinite(row) ? Math.max(0, Math.min(4, row)) * 25 : 50
  return {
    background: `radial-gradient(circle at ${x}% ${y}%, ${color} 0%, ${color}99 22%, transparent 62%), #111`,
  }
}

export function lightingPatch(
  lighting: BackdropLighting,
  patch: Partial<BackdropLighting>
) {
  const next = { ...lighting, ...patch }
  if (
    next.intensity === 0 &&
    (patch.direction !== undefined ||
      patch.target !== undefined ||
      patch.color !== undefined)
  ) {
    next.intensity = 50
  }
  return next
}
