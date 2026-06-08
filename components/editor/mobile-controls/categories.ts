import type * as React from "react"
import {
  RiArrowRightUpLine,
  RiBrushLine,
  RiCropLine,
  RiDragMove2Line,
  RiFullscreenLine,
  RiLayoutGrid2Line,
  RiLayoutMasonryLine,
  RiMoonClearLine,
  RiPaletteLine,
  RiRotateLockLine,
  RiSettingsLine,
  RiSmartphoneLine,
  RiSparkling2Line,
  RiStackLine,
  RiSunLine,
  RiText,
  RiTwitterXLine,
} from "@remixicon/react"

import type { EnhancePreset } from "@/lib/editor/store"

export type TabId = "design" | "tools"

export type CategoryId =
  | "aspect"
  | "frame"
  | "layout"
  | "fit"
  | "move"
  | "layers"
  | "enhance"
  | "text"
  | "annotate"
  | "background"
  | "backdrop"
  | "border"
  | "padding"
  | "shadow"
  | "tweet"
  | "transform"

export type Category = {
  id: CategoryId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const TABS: {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "design", label: "Design", icon: RiLayoutMasonryLine },
  { id: "tools", label: "Tools", icon: RiSettingsLine },
]

export const DESIGN_CATEGORIES: Category[] = [
  { id: "aspect", label: "Ratio", icon: RiCropLine },
  { id: "frame", label: "Frame", icon: RiSmartphoneLine },
  { id: "layout", label: "Layout", icon: RiLayoutMasonryLine },
  { id: "text", label: "Text", icon: RiText },
  { id: "annotate", label: "Annotate", icon: RiArrowRightUpLine },
  { id: "fit", label: "Fit", icon: RiFullscreenLine },
  { id: "move", label: "Move", icon: RiDragMove2Line },
  { id: "layers", label: "Layers", icon: RiStackLine },
  { id: "enhance", label: "Enhance", icon: RiSparkling2Line },
]

export const TOOLS_CATEGORIES: Category[] = [
  { id: "tweet", label: "Post", icon: RiTwitterXLine },
  { id: "background", label: "Background", icon: RiPaletteLine },
  { id: "backdrop", label: "Backdrop", icon: RiSunLine },
  { id: "border", label: "Border", icon: RiBrushLine },
  { id: "padding", label: "Padding", icon: RiLayoutGrid2Line },
  { id: "shadow", label: "Shadow", icon: RiMoonClearLine },
  { id: "transform", label: "Transform", icon: RiRotateLockLine },
]

export const ALL_CATEGORIES = [...DESIGN_CATEGORIES, ...TOOLS_CATEGORIES]

// Layout sizes to preset-card content (aspect-ratio driven) with a viewport
// max-h cap in mobile-controls/index.tsx. Layers keeps a fixed scroll height.
export const TALL_CATEGORIES = new Set<CategoryId>(["layers"])

export const ENHANCE_PRESETS: {
  id: EnhancePreset
  label: string
  swatch: string
  filter?: string
}[] = [
  { id: "off", label: "Off", swatch: "linear-gradient(135deg,#888,#555)" },
  {
    id: "auto",
    label: "Auto",
    swatch: "linear-gradient(135deg,#7dd3fc,#a78bfa)",
    filter: "brightness(1.04) contrast(1.08) saturate(1.1)",
  },
  {
    id: "vivid",
    label: "Vivid",
    swatch: "linear-gradient(135deg,#f43f5e,#f59e0b)",
    filter: "saturate(1.35) contrast(1.12)",
  },
  {
    id: "soft",
    label: "Soft",
    swatch: "linear-gradient(135deg,#fde2e4,#cdb4db)",
    filter: "brightness(1.06) saturate(0.9)",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    swatch: "linear-gradient(135deg,#1f2937,#6b7280)",
    filter: "contrast(1.25) saturate(1.2)",
  },
  {
    id: "sharp",
    label: "Sharp",
    swatch: "linear-gradient(135deg,#10b981,#0ea5e9)",
    filter: "contrast(1.18)",
  },
]
