import { DEFAULT_IMAGE_BACKGROUND_ENTRY } from "../presets"
import type { CanvasState, EditorState } from "../state-types"

import { makeId } from "./canvas-helpers"

export const FIRST_CANVAS_ID = "canvas-default"

export const HISTORY_LIMIT = 100
export const GROUP_MERGE_MS = 600
export const MAX_CANVASES = 20
export const MAX_SCREENSHOT_SLOTS = 3

export const CLEAR_SELECTION = {
  selectedTextId: null,
  selectedAssetId: null,
  selectedAnnotationShapeId: null,
  selectedScreenshotSlotId: null,
  isScreenshotSelected: false,
} as const

export const DEFAULT_CANVAS_BASE: Omit<CanvasState, "id" | "position"> = {
  screenshot: null,
  originalScreenshot: null,
  lastCropRegion: null,
  background: {
    type: "image",
    value:
      DEFAULT_IMAGE_BACKGROUND_ENTRY?.preview ??
      DEFAULT_IMAGE_BACKGROUND_ENTRY?.thumb ??
      DEFAULT_IMAGE_BACKGROUND_ENTRY?.full ??
      "",
    sourceUrl: DEFAULT_IMAGE_BACKGROUND_ENTRY?.full,
    thumbUrl: DEFAULT_IMAGE_BACKGROUND_ENTRY?.thumb,
  },
  padding: 40,
  borderRadius: 7,
  canvasBorderRadius: 0,
  border: { color: null, width: 1, style: "solid", padding: 0 },
  backdrop: {
    effects: {
      noise: 0,
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      grayscale: 0,
      sepia: 0,
      invert: 0,
      opacity: 100,
    },
    pattern: {
      ids: [],
      intensity: 50,
      thickness: 1,
      color: "#FFFFFF",
    },
    lighting: {
      target: "inner",
      intensity: 0,
      direction: "0-0",
      color: "#FFFFFF",
    },
    filter: "none",
  },
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
  objectFit: "contain",
  screenshotLayer: {
    zIndex: 1,
    opacity: 100,
    blendMode: "normal",
    hidden: false,
  },
  shadow: {
    type: "none",
    intensity: 40,
    lightSource: "center",
    color: "#050505",
  },
  overlay: {
    id: null,
    opacity: 50,
    position: "overlay",
  },
  frame: {
    id: "none",
    color: "black",
    orientation: "vertical",
  },
  portrait: {
    mode: "off",
    intensity: 60,
    position: 50,
    distance: 50,
  },
  texts: [],
  assets: [],
  enhance: "off",
  annotations: [],
  annotationShapes: [],
  screenshotSlots: [],
  frameAddress: "",
  tweet: null,
}

export const createCanvas = (
  id: string = makeId(),
  position = { x: 0, y: 0 }
): CanvasState => ({
  ...DEFAULT_CANVAS_BASE,
  id,
  position,
})

export const DEFAULT_STATE: EditorState = {
  activeTool: "pointer",
  aspect: { id: "auto", w: 0, h: 0 },
  canvasZoom: 100,
  annotation: {
    mode: "pen",
    color: "#ef4444",
    strokeWidth: 4,
    lineStyle: "solid",
    blurEffect: "blur",
    blurAmount: 14,
  },
  canvases: [createCanvas(FIRST_CANVAS_ID, { x: 0, y: 0 })],
  activeCanvasId: FIRST_CANVAS_ID,
}
