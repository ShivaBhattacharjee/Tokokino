import { resolveLayoutPresetGeometry, type LayoutPreset } from "./present-presets"
import type {
  AssetFilter,
  DeviceFrame,
  Shadow,
  Tilt,
} from "./state-types"
import type { CustomPresetSummary } from "./store"

/**
 * Shared helpers for re-applying a layout preset's geometry to a canvas.
 *
 * Three different call sites used to inline the same math, and they kept
 * drifting apart:
 *  - `store.setAspect` — recomputes slot positions when the canvas aspect
 *    ratio changes so an active preset stays visually correct.
 *  - `store.applyPresetSnapshot` — applies a custom preset (canvas style +
 *    geometry) in one history entry.
 *  - `present-presets-section.applyLayoutPreset` + preview-card virtual
 *    canvas builders — render the saved geometry both live and in
 *    thumbnails.
 *
 * Centralising the math means every site shares the same definition of
 * "relativeSlotPositions adds 50 to yPct" and "mainOffset is a percent of
 * the 16:10 design canvas". Most importantly, it gives us one place to
 * look up the *active* preset geometry (built-in LAYOUT_PRESETS *or* a
 * user-saved custom preset) so the aspect-change path stops silently
 * skipping custom presets.
 */

/** The design canvas used to interpret `mainOffset` percentages as pixels. */
export const PRESET_BASE_WIDTH = 1100
export const PRESET_DESIGN_HEIGHT = PRESET_BASE_WIDTH * (10 / 16)

/** A slot config shape that both LayoutPreset.slots and CustomPresetGeometry.slots satisfy. */
export type PresetSlotConfig = {
  xPct: number
  yPct: number
  widthPct?: number
  heightPct?: number
  rotation: number
  tilt: Tilt
  scale: number
  zIndex?: number
  filter?: AssetFilter
  hidden?: boolean
  objectFit?: "contain" | "cover" | "fill"
  shadow?: Shadow
}

/**
 * Common shape of LayoutPreset (resolved for the current frame) and
 * CustomPresetSummary.geometry. Only the fields the helpers below read are
 * required; concrete preset types carry more.
 */
export type PresetGeometryLike = {
  canvasTilt: Tilt
  canvasScale: number
  slots: PresetSlotConfig[]
  mainOffset?: { xPct: number; yPct: number }
  relativeSlotPositions?: boolean
}

/**
 * Resolve a slot's effective position. When `relativeSlotPositions` is set
 * the config carries deltas from the natural row layout, not absolute
 * percentages — apply them on top of the row position.
 */
export function resolveSlotPositionPct({
  config,
  naturalSlotXPct,
  relativeSlotPositions,
}: {
  config: PresetSlotConfig
  naturalSlotXPct: number
  relativeSlotPositions: boolean | undefined
}): { xPct: number; yPct: number } {
  return {
    xPct: relativeSlotPositions ? naturalSlotXPct + config.xPct : config.xPct,
    yPct: relativeSlotPositions ? 50 + config.yPct : config.yPct,
  }
}

/** Convert a percent `mainOffset` to pixel coordinates against the design canvas. */
export function resolveMainOffsetPx(
  mainOffset: { xPct: number; yPct: number } | undefined
): { x: number; y: number } {
  if (!mainOffset) return { x: 0, y: 0 }
  return {
    x: (mainOffset.xPct / 100) * PRESET_BASE_WIDTH,
    y: (mainOffset.yPct / 100) * PRESET_DESIGN_HEIGHT,
  }
}

/**
 * Pick the geometry of whichever preset is currently active for the given
 * canvas frame. Custom presets win if somehow both ids are set.
 *
 * Returns null when nothing is active (the "single" tab, or no preset id
 * matches), so callers can skip recompute paths cleanly.
 */
export function resolveActivePresetGeometry({
  activeLayoutPresetId,
  activeCustomPresetId,
  layoutPresets,
  customPresets,
  frame,
}: {
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  layoutPresets: LayoutPreset[]
  customPresets: CustomPresetSummary[]
  frame: DeviceFrame
}): PresetGeometryLike | null {
  if (activeCustomPresetId) {
    const found = customPresets.find((p) => p.id === activeCustomPresetId)
    if (found) return found.geometry
  }
  if (activeLayoutPresetId) {
    const layout = layoutPresets.find((p) => p.id === activeLayoutPresetId)
    if (layout) return resolveLayoutPresetGeometry(layout, frame)
  }
  return null
}
