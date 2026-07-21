import {
  resolveLayoutPresetGeometry,
  type LayoutPreset,
  type PresentPreset,
} from "./present-presets"
import { resolveMainOffsetPx, resolveSlotPositionPct } from "./preset-geometry"
import { computeRowLayout } from "./screenshot-layout"
import type {
  AspectState,
  CanvasState,
  ScreenshotPosition,
  Tilt,
} from "./state-types"

/**
 * Pure planner shared by the "apply preset" reducer-style callbacks in
 * `present-presets-section.tsx` and the preview-card virtualCanvas builders.
 *
 * Both used to inline the same math (computeRowLayout, resolveSlotPositionPct,
 * scale/tilt/position overrides). When a new field needed to be overridden by
 * a preset, the two paths drifted. Centralising the math here means the live
 * application and the thumbnail preview always pick the same target values.
 */
export type PlannedSlotPatch = {
  xPct: number
  yPct: number
  widthPct?: number
  rotation: number
  tilt: Tilt
  scale: number
  zIndex?: number
}

export type PresetPlan = {
  canvasTilt: Tilt
  canvasScale: number
  screenshotPosition: ScreenshotPosition
  screenshotOffset: { x: number; y: number }
  /** One entry per slot the preset targets, in display order. */
  slots: PlannedSlotPatch[]
}

const aspectRatio = (aspect: AspectState) => (aspect.w || 16) / (aspect.h || 10)

/** The preset-independent half of {@link planSinglePreset}: where the extra
 * slots sit in the natural row, and the scale they inherit. Every single preset
 * shares this, so the preview rail computes it once instead of per card. */
export type SinglePresetSlotRow = {
  placements: Array<{ xPct: number; widthPct: number }>
  scale: number
}

export function planSinglePresetSlotRow(
  canvas: CanvasState,
  aspect: AspectState
): SinglePresetSlotRow {
  const naturalLayout = computeRowLayout(
    [
      { id: "__main__", frame: canvas.frame },
      ...canvas.screenshotSlots.map((slot) => ({
        id: slot.id,
        frame: canvas.frame,
      })),
    ],
    aspectRatio(aspect)
  )
  return {
    // Single presets are tilt/position presets — they follow the canvas'
    // current zoom rather than forcing a fixed scale. This keeps the preset
    // thumbnails (and applying a preset) in sync with the Zoom / Scale
    // sliders, and stays idempotent under repeated application and aspect
    // changes.
    scale: canvas.scale,
    placements: canvas.screenshotSlots.map((slot, i) => ({
      xPct: naturalLayout[i + 1]?.xPct ?? slot.xPct,
      widthPct: naturalLayout[i + 1]?.widthPct ?? slot.widthPct,
    })),
  }
}

export function planSinglePreset(
  preset: PresentPreset,
  canvas: CanvasState,
  aspect: AspectState
): PresetPlan {
  const { placements, scale } = planSinglePresetSlotRow(canvas, aspect)
  return {
    canvasTilt: preset.tilt,
    canvasScale: scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    slots: placements.map((placement) => ({
      xPct: placement.xPct,
      yPct: 50,
      widthPct: placement.widthPct,
      rotation: 0,
      tilt: preset.tilt,
      scale,
    })),
  }
}

export function planLayoutPreset(
  preset: LayoutPreset,
  canvas: CanvasState,
  aspect: AspectState
): PresetPlan {
  const geometry = resolveLayoutPresetGeometry(preset, canvas.frame)
  const naturalLayout = computeRowLayout(
    [
      { id: "__main__", frame: canvas.frame },
      ...geometry.slots.map((_, i) => ({
        id: `_layout_${i}`,
        frame: canvas.frame,
      })),
    ],
    aspectRatio(aspect)
  )
  return {
    canvasTilt: geometry.canvasTilt,
    canvasScale: geometry.canvasScale,
    screenshotPosition: "center",
    screenshotOffset: resolveMainOffsetPx(geometry.mainOffset),
    slots: geometry.slots.map((config, i) => {
      const { xPct, yPct } = resolveSlotPositionPct({
        config,
        naturalSlotXPct: naturalLayout[i + 1]?.xPct ?? 75,
        relativeSlotPositions: geometry.relativeSlotPositions,
      })
      return {
        xPct,
        yPct,
        rotation: config.rotation,
        tilt: config.tilt,
        scale: config.scale,
        ...(config.zIndex !== undefined ? { zIndex: config.zIndex } : {}),
      }
    }),
  }
}
