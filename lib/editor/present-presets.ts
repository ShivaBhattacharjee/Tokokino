import { isBrowserFrame } from "@/lib/browser-frame"

import type { DeviceFrame, Tilt } from "./state-types"

export type PresentPreset = {
  id: string
  name: string
  tilt: Tilt
  scale: number
}

export type SlotLayoutConfig = {
  xPct: number
  yPct: number
  rotation: number
  tilt: Tilt
  scale: number
}

export type LayoutPreset = {
  id: string
  name: string
  canvasTilt: Tilt
  canvasScale: number
  slots: SlotLayoutConfig[]
  // Percentage of canvas width/height so layout is aspect-ratio independent
  mainOffset?: { xPct: number; yPct: number }
}

// Row layout for 2 equal "none" frames at 16:10 puts:
//   main  at x≈25%  (width≈48%, spans 1–49%)
//   natural slot at x≈75% (spans 51–99%)
// Slot xPct/yPct override the position; row layout still sets the width.
// Keeping slot near x=75 centers the composition (avg of 25+75=50%).
// Moving slot left creates overlap but shifts the center leftward.
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "side-by-side",
    name: "Side by Side",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 75, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
  },
  {
    id: "depth-duo",
    name: "Depth Duo",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 76, yPct: 62, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
  },
  {
    id: "cascade",
    name: "Cascade",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 74, yPct: 67, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
  },
  {
    // Rotations create the fan; base positions match natural row (25%+75%)
    // so the composition is centered before rotation is applied.
    id: "fan-out",
    name: "Fan Out",
    canvasTilt: { rx: 0, ry: 0, rz: -13 },
    canvasScale: 92,
    slots: [
      { xPct: 75, yPct: 50, rotation: 14, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 92 },
    ],
  },
  {
    id: "scatter",
    name: "Scatter",
    canvasTilt: { rx: 0, ry: 0, rz: -9 },
    canvasScale: 90,
    slots: [
      { xPct: 74, yPct: 52, rotation: 10, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 90 },
    ],
  },
  {
    id: "perspective",
    name: "Perspective",
    canvasTilt: { rx: 0, ry: -25, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 69, yPct: 64, rotation: 0, tilt: { rx: 0, ry: 24, rz: 0 }, scale: 100 },
    ],
    mainOffset: { xPct: 6.42, yPct: -7.2 },
  },
  {
    id: "drift",
    name: "Drift",
    canvasTilt: { rx: 0, ry: 0, rz: -16 },
    canvasScale: 100,
    slots: [
      { xPct: 69.2, yPct: 62.9, rotation: 0, tilt: { rx: 0, ry: 0, rz: 18 }, scale: 100 },
    ],
    mainOffset: { xPct: 11, yPct: -6.2 },
  },
  {
    id: "step",
    name: "Step",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 70.2, yPct: 61.6, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
    mainOffset: { xPct: 10.1, yPct: -9 },
  },
  {
    id: "stacked",
    name: "Stacked",
    canvasTilt: { rx: 0, ry: 0, rz: -16 },
    canvasScale: 90,
    slots: [
      { xPct: 66.4, yPct: 54.1, rotation: 9, tilt: { rx: 0, ry: 0, rz: -29 }, scale: 90 },
    ],
    mainOffset: { xPct: 10.1, yPct: 0 },
  },
]

export const PRESENT_PRESETS: PresentPreset[] = [
  {
    id: "default",
    name: "Default",
    tilt: { rx: 0, ry: 0, rz: 0 },
    scale: 100,
  },
  {
    id: "left-depth",
    name: "Left Depth",
    tilt: { rx: 15, ry: 20, rz: -9 },
    scale: 85,
  },
  {
    id: "right-depth",
    name: "Right Depth",
    tilt: { rx: 15, ry: -20, rz: 10 },
    scale: 85,
  },
  {
    id: "axis-drift",
    name: "Axis Drift",
    tilt: { rx: 2, ry: -6, rz: -4 },
    scale: 92,
  },
  {
    id: "axis-stage-left",
    name: "Axis Stage L",
    tilt: { rx: 42, ry: 12, rz: -18 },
    scale: 92,
  },
  {
    id: "axis-stage-right",
    name: "Axis Stage R",
    tilt: { rx: 42, ry: -12, rz: 18 },
    scale: 92,
  },
  {
    id: "axis-front",
    name: "Axis Front",
    tilt: { rx: 24, ry: 0, rz: 0 },
    scale: 92,
  },
]

export function resolvePresentPresetScale(
  preset: PresentPreset,
  frame: DeviceFrame
) {
  if (preset.id === "default") return 100
  if (preset.id.startsWith("axis-")) return preset.scale
  if (frame.id === "none" || isBrowserFrame(frame.id)) return 85
  if (
    frame.id.startsWith("macbook") ||
    frame.id.startsWith("imac") ||
    frame.id.includes("display")
  ) {
    return 90
  }
  return 100
}
