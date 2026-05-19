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
  zIndex?: number
}

export type LayoutPresetGeometry = {
  canvasTilt: Tilt
  canvasScale: number
  slots: SlotLayoutConfig[]
  // Percentage of canvas width/height so layout is aspect-ratio independent
  mainOffset?: { xPct: number; yPct: number }
  // When true, slot xPct/yPct are offsets from the natural row position
  // (xPct offset from natural center, yPct offset from 50% vertical center).
  // This keeps visual spacing consistent across all canvas aspect ratios.
  relativeSlotPositions?: boolean
}

export type LayoutPreset = {
  id: string
  name: string
  // Default geometry is used for browsers, desktop frames, landscape devices, and no-frame layouts.
  portraitDevice?: LayoutPresetGeometry
} & LayoutPresetGeometry

export type LayoutPresetDeviceClass = "portrait-device" | "default"

export function layoutPresetDeviceClassForFrame(
  frame: DeviceFrame
): LayoutPresetDeviceClass {
  if (
    frame.orientation === "vertical" &&
    !isBrowserFrame(frame.id) &&
    (frame.id.startsWith("iphone") ||
      frame.id.startsWith("ipad") ||
      frame.id.startsWith("galaxy") ||
      frame.id.startsWith("pixel") ||
      frame.id.startsWith("nothing"))
  ) {
    return "portrait-device"
  }
  return "default"
}

export function resolveLayoutPresetGeometry(
  preset: LayoutPreset,
  frame: DeviceFrame
): LayoutPresetGeometry {
  if (layoutPresetDeviceClassForFrame(frame) === "portrait-device") {
    return preset.portraitDevice ?? preset
  }
  return preset
}

// Row layout for 2 equal "none" frames at 16:10 puts:
//   main  at x≈25%  (width≈48%, spans 1–49%)
//   natural slot at x≈75% (spans 51–99%)
// Slot xPct/yPct override the position; row layout still sets the width.
// Keeping slot near x=75 centers the composition (avg of 25+75=50%).
// Moving slot left creates overlap but shifts the center leftward.
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "triple",
    name: "Flat",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 110,
    slots: [
      { xPct: 50, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 110, zIndex: 3 },
      { xPct: 83.11, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 110, zIndex: 2 },
    ],
    mainOffset: { xPct: 0, yPct: 0 },
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 110,
      slots: [
        { xPct: 50, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 110, zIndex: 3 },
        { xPct: 79.83, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 110, zIndex: 2 },
      ],
      mainOffset: { xPct: 0, yPct: 0 },
    },
  },
  {
    id: "triple-scatter",
    name: "Scatter",
    canvasTilt: { rx: 0, ry: 0, rz: -16 },
    canvasScale: 140,
    slots: [
      { xPct: 50, yPct: 47.1, rotation: -8, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 140, zIndex: 3 },
      { xPct: 78.55, yPct: 42.42, rotation: -4, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 140, zIndex: 2 },
    ],
    mainOffset: { xPct: 7.91, yPct: 5.9 },
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -12 },
      canvasScale: 100,
      slots: [
        { xPct: 50, yPct: 50, rotation: -6, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100, zIndex: 3 },
        { xPct: 69.77, yPct: 50, rotation: -3, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100, zIndex: 2 },
      ],
      mainOffset: { xPct: 11.33, yPct: 2.81 },
    },
  },
  {
    id: "triple-cascade",
    name: "Cascade",
    canvasTilt: { rx: 0, ry: 0, rz: -16 },
    canvasScale: 130,
    slots: [
      { xPct: 50, yPct: 43.83, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 130, zIndex: 3 },
      { xPct: 78.13, yPct: 50, rotation: 16, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 130, zIndex: 2 },
    ],
    mainOffset: { xPct: 5.3, yPct: 0 },
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -16 },
      canvasScale: 100,
      slots: [
        { xPct: 50, yPct: 46.63, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100, zIndex: 3 },
        { xPct: 76.01, yPct: 52.55, rotation: 16, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100, zIndex: 2 },
      ],
      mainOffset: { xPct: 5.69, yPct: 1.35 },
    },
  },
  {
    id: "side-by-side",
    name: "Side by Side",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 75, yPct: 50, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 100,
      slots: [
        { xPct: 0, yPct: 0, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
      ],
      mainOffset: { xPct: 0, yPct: 0 },
      relativeSlotPositions: true,
    },
  },
  {
    id: "depth-duo",
    name: "Depth Duo",
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [
      { xPct: 76, yPct: 62, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
    ],
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 100,
      slots: [
        { xPct: 0, yPct: 7.91, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
      ],
      mainOffset: { xPct: 0, yPct: -7.85 },
      relativeSlotPositions: true,
    },
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
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -13 },
      canvasScale: 92,
      slots: [
        { xPct: 2.82, yPct: 0, rotation: 14, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 92 },
      ],
      mainOffset: { xPct: 0, yPct: 0 },
      relativeSlotPositions: true,
    },
  },
  {
    id: "scatter",
    name: "Scatter",
    canvasTilt: { rx: 0, ry: 0, rz: -9 },
    canvasScale: 90,
    slots: [
      { xPct: 74, yPct: 52, rotation: 10, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 90 },
    ],
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -9 },
      canvasScale: 90,
      slots: [
        { xPct: 0.72, yPct: 0, rotation: 10, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 90 },
      ],
      mainOffset: { xPct: 0, yPct: 0 },
      relativeSlotPositions: true,
    },
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
    portraitDevice: {
      canvasTilt: { rx: 0, ry: -25, rz: 0 },
      canvasScale: 100,
      slots: [
        { xPct: -3.07, yPct: 8.04, rotation: 0, tilt: { rx: 0, ry: 24, rz: 0 }, scale: 100 },
      ],
      mainOffset: { xPct: 0, yPct: -7.89 },
      relativeSlotPositions: true,
    },
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
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -16 },
      canvasScale: 100,
      slots: [
        { xPct: 0, yPct: 6.01, rotation: 0, tilt: { rx: 0, ry: 0, rz: 18 }, scale: 100 },
      ],
      mainOffset: { xPct: 0, yPct: -6.3 },
      relativeSlotPositions: true,
    },
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
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 100,
      slots: [
        { xPct: 0, yPct: 11.55, rotation: 0, tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100 },
      ],
      mainOffset: { xPct: 0, yPct: -9.11 },
      relativeSlotPositions: true,
    },
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
    portraitDevice: {
      canvasTilt: { rx: 0, ry: 0, rz: -16 },
      canvasScale: 90,
      slots: [
        { xPct: -6.38, yPct: 4.1, rotation: 9, tilt: { rx: 0, ry: 0, rz: -29 }, scale: 90 },
      ],
      mainOffset: { xPct: 1.08, yPct: 0 },
      relativeSlotPositions: true,
    },
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
  if (frame.id === "none" || isBrowserFrame(frame.id)) return 100
  if (isDesktopFrame(frame.id)) return 100
  return 100
}

function isDesktopFrame(frameId: string) {
  return (
    frameId.startsWith("macbook") ||
    frameId.startsWith("imac") ||
    frameId.includes("display")
  )
}
