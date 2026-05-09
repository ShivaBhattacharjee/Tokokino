export type AspectId =
  | "auto"
  | "16:9"
  | "16:10"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16"

export const ASPECTS: { id: AspectId; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "16:9", label: "16:9" },
  { id: "16:10", label: "16:10" },
  { id: "4:3", label: "4:3" },
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
  { id: "9:16", label: "9:16" },
]

export type FrameId = "browser" | "chrome" | "macos" | "iphone" | "none"

export const FRAMES: { id: FrameId; label: string }[] = [
  { id: "browser", label: "Safari" },
  { id: "chrome", label: "Chrome" },
  { id: "macos", label: "macOS" },
  { id: "iphone", label: "iPhone" },
  { id: "none", label: "None" },
]

/** Layers are intentionally scoped to the three parallax-able types. */
export type LayerKind = "screenshot" | "background" | "text"

export type Layer = {
  id: string
  kind: LayerKind
  name: string
  visible: boolean
  meta?: string
}

export type Preset = {
  id: string
  name: string
  index: string
  /** CSS background for the preview swatch */
  preview: string
}

export const PRESETS: Preset[] = [
  {
    id: "onyx-dots",
    name: "Onyx Dots",
    index: "01",
    preview:
      "radial-gradient(oklch(1 0 0 / 0.08) 1px, transparent 1px) 0 0 / 10px 10px, oklch(0.12 0 0)",
  },
  {
    id: "paper-tilt",
    name: "Paper Tilt",
    index: "02",
    preview:
      "radial-gradient(oklch(0 0 0 / 0.06) 1px, transparent 1px) 0 0 / 10px 10px, oklch(0.96 0 0)",
  },
  {
    id: "soft-fog",
    name: "Soft Fog",
    index: "03",
    preview: "linear-gradient(180deg, oklch(0.96 0 0), oklch(0.88 0 0))",
  },
  {
    id: "ink",
    name: "Ink",
    index: "04",
    preview: "linear-gradient(180deg, oklch(0.18 0 0), oklch(0.08 0 0))",
  },
  {
    id: "mountain",
    name: "Wanderlust",
    index: "05",
    preview:
      "linear-gradient(180deg, oklch(0.95 0 0), oklch(0.72 0 0) 60%, oklch(0.3 0 0))",
  },
  {
    id: "ember",
    name: "Ember",
    index: "06",
    preview: "linear-gradient(180deg, oklch(0.96 0 0), oklch(0.85 0.05 40))",
  },
]
