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
  RiShapesLine,
  RiSmartphoneLine,
  RiSparkling2Line,
  RiStackLine,
  RiSunLine,
  RiText,
  RiTwitterXLine,
} from "@remixicon/react"

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
  | "shapes"
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
  { id: "shapes", label: "Shapes", icon: RiShapesLine },
  { id: "border", label: "Border", icon: RiBrushLine },
  { id: "padding", label: "Padding", icon: RiLayoutGrid2Line },
  { id: "shadow", label: "Shadow", icon: RiMoonClearLine },
  { id: "transform", label: "Transform", icon: RiRotateLockLine },
]

export const ALL_CATEGORIES = [...DESIGN_CATEGORIES, ...TOOLS_CATEGORIES]

// Layout sizes to preset-card content (aspect-ratio driven) with a viewport
// max-h cap in mobile-controls/index.tsx. Layers keeps a fixed scroll height.
export const TALL_CATEGORIES = new Set<CategoryId>(["layers", "shapes"])
