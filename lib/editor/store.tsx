"use client"

import * as React from "react"
import { create } from "zustand"

import { FONT_FAMILIES } from "./fonts"
import { DEFAULT_IMAGE_BACKGROUND } from "./presets"
import { LAYOUT_PRESETS } from "./present-presets"
import { computeRowLayout } from "./screenshot-layout"
import type {
  Annotation,
  AnnotationPoint,
  AnnotationShape,
  AnnotationStroke,
  AspectState,
  AssetElement,
  AssetFilter,
  Background,
  BackdropEffects,
  BackdropPattern,
  Border,
  CanvasState,
  CropRegion,
  DeviceFrame,
  EditorState,
  EditorTool,
  EnhancePreset,
  Overlay,
  Portrait,
  ScreenshotLayer,
  ScreenshotPosition,
  ScreenshotSlot,
  Shadow,
  TextElement,
  Tilt,
} from "./state-types"

export * from "./state-types"
export {
  ANNOTATION_COLORS,
  ANNOTATION_STROKES,
  AUTO_PLACEHOLDER_GRADIENT,
  BACKDROP_PATTERNS,
  BACKGROUND_LIBRARY,
  DEFAULT_IMAGE_BACKGROUND,
  GRADIENT_LIBRARY,
  GRADIENT_PRESETS,
  OVERLAY_COUNT,
  SCREENSHOT_POSITIONS,
  SOLID_PRESETS,
  overlayThumbUrl,
  overlayUrl,
  screenshotPositionAnchor,
} from "./presets"
export { FONT_FAMILIES } from "./fonts"
export {
  assetFilterCss,
  backgroundCss,
  effectsFilterCss,
  enhanceFilterCss,
  patternCssFor,
  shadowBoxShadowCss,
  shadowCss,
  shadowDropFilterCss,
} from "./css-utils"
export {
  dynamicPatternColors,
  generateAutoGradients,
  pickContrastColor,
  pickContrastColorAtPosition,
  sampleImageColors,
  sampleImageColorsRaw,
} from "./color-utils"

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const FIRST_CANVAS_ID = "canvas-default"

const DEFAULT_CANVAS_BASE: Omit<CanvasState, "id" | "position"> = {
  screenshot: null,
  originalScreenshot: null,
  lastCropRegion: null,
  background: {
    type: "image",
    value: DEFAULT_IMAGE_BACKGROUND,
  },
  padding: 40,
  borderRadius: 7,
  canvasBorderRadius: 16,
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
    filter: "none",
  },
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
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
}

const createCanvas = (
  id: string = makeId(),
  position = { x: 0, y: 0 }
): CanvasState => ({
  ...DEFAULT_CANVAS_BASE,
  id,
  position,
})

const DEFAULT_STATE: EditorState = {
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

const HISTORY_LIMIT = 100
const GROUP_MERGE_MS = 600

export const MAX_CANVASES = 20
export const MAX_SCREENSHOT_SLOTS = 3

type SetPatch =
  | Partial<EditorState>
  | ((state: EditorState) => Partial<EditorState>)

type CanvasPatch =
  | Partial<CanvasState>
  | ((canvas: CanvasState, state: EditorState) => Partial<CanvasState>)

type EditorActions = {
  setActiveTool: (t: EditorTool) => void
  setPresetTab: (tab: "single" | "multi") => void
  setActiveLayoutPresetId: (id: string | null) => void
  setScreenshot: (s: string | null, canvasId?: string) => void
  applyCroppedScreenshot: (
    s: string,
    region: CropRegion,
    canvasId?: string
  ) => void
  setAspect: (a: AspectState) => void
  setBackground: (b: Background, canvasId?: string) => void
  setPadding: (n: number, canvasId?: string) => void
  setBorderRadius: (n: number, canvasId?: string) => void
  setCanvasBorderRadius: (n: number, canvasId?: string) => void
  setBorder: (b: Border, canvasId?: string) => void
  setBackdropEffects: (e: BackdropEffects, canvasId?: string) => void
  setBackdropPattern: (p: BackdropPattern, canvasId?: string) => void
  setBackdropFilter: (f: AssetFilter, canvasId?: string) => void
  setTilt: (t: Tilt, canvasId?: string) => void
  setScale: (n: number, canvasId?: string) => void
  setTiltAndScale: (t: Tilt, scale: number, canvasId?: string) => void
  setCanvasZoom: (n: number) => void
  setScreenshotPosition: (p: ScreenshotPosition, canvasId?: string) => void
  setScreenshotOffset: (o: { x: number; y: number }, canvasId?: string) => void
  setScreenshotPlacement: (
    p: ScreenshotPosition,
    o: { x: number; y: number },
    canvasId?: string
  ) => void
  updateScreenshotLayer: (
    patch: Partial<ScreenshotLayer>,
    canvasId?: string
  ) => void
  setShadow: (s: Shadow, canvasId?: string) => void
  setOverlay: (o: Overlay, canvasId?: string) => void
  setFrame: (f: DeviceFrame, canvasId?: string) => void
  setFrameForMatchingScreenshots: (f: DeviceFrame, canvasId?: string) => void
  setFrameAddress: (address: string, canvasId?: string) => void
  setObjectFit: (fit: "contain" | "cover" | "fill", canvasId?: string) => void
  bringScreenshotToFront: (canvasId?: string) => void
  sendScreenshotToBack: (canvasId?: string) => void
  setPortrait: (p: Portrait, canvasId?: string) => void
  setEnhance: (e: EnhancePreset, canvasId?: string) => void
  setAnnotation: (patch: Partial<Annotation>) => void
  addAnnotationStroke: (
    stroke: Omit<AnnotationStroke, "id" | "zIndex">,
    canvasId?: string
  ) => string
  updateAnnotationStroke: (
    id: string,
    points: AnnotationPoint[],
    canvasId?: string
  ) => void
  updateAnnotationStrokeLayer: (
    id: string,
    patch: Partial<
      Pick<AnnotationStroke, "zIndex" | "opacity" | "blendMode" | "hidden">
    >,
    canvasId?: string
  ) => void
  deleteAnnotationStroke: (id: string, canvasId?: string) => void
  addAnnotationShape: (
    shape: Omit<AnnotationShape, "id" | "zIndex">,
    canvasId?: string
  ) => string
  updateAnnotationShape: (
    id: string,
    patch: Partial<AnnotationShape>,
    canvasId?: string
  ) => void
  deleteAnnotationShape: (id: string, canvasId?: string) => void
  duplicateAnnotationShape: (id: string, canvasId?: string) => string | null
  bringAnnotationShapeToFront: (id: string, canvasId?: string) => void
  sendAnnotationShapeToBack: (id: string, canvasId?: string) => void
  clearAnnotations: (canvasId?: string) => void
  addText: (canvasId?: string) => string
  updateText: (
    id: string,
    patch: Partial<TextElement>,
    canvasId?: string
  ) => void
  deleteText: (id: string, canvasId?: string) => void
  duplicateText: (id: string, canvasId?: string) => string | null
  bringTextToFront: (id: string, canvasId?: string) => void
  sendTextToBack: (id: string, canvasId?: string) => void
  setSelectedTextId: (id: string | null) => void
  addAsset: (src: string, canvasId?: string) => string
  updateAsset: (
    id: string,
    patch: Partial<AssetElement>,
    canvasId?: string
  ) => void
  deleteAsset: (id: string, canvasId?: string) => void
  duplicateAsset: (id: string, canvasId?: string) => string | null
  bringAssetToFront: (id: string, canvasId?: string) => void
  sendAssetToBack: (id: string, canvasId?: string) => void
  setSelectedAssetId: (id: string | null) => void
  setSelectedAnnotationShapeId: (id: string | null) => void
  setSelectedScreenshotSlotId: (id: string | null) => void
  setIsScreenshotSelected: (selected: boolean) => void
  setIsPreviewMode: (p: boolean) => void
  setIsPreviewAutoScroll: (a: boolean) => void
  setPreviewAutoScrollDelay: (d: number) => void
  setPreviewAnimation: (a: "slide" | "fade" | "zoom" | "flip") => void
  setBulkEditMode: (b: boolean) => void
  setBulkCanvasDragging: (dragging: boolean) => void
  setBulkViewportZoom: (zoom: number) => void
  setBulkScale: (n: number) => void
  reset: () => void
  undo: () => void
  redo: () => void
  addCanvas: () => string | null
  removeCanvas: (id: string) => void
  duplicateCanvas: (id?: string) => string | null
  setActiveCanvasId: (id: string) => void
  setCanvasPosition: (id: string, position: { x: number; y: number }) => void
  setCanvasPositions: (
    positions: Record<string, { x: number; y: number }>
  ) => void
  requestBulkFitView: () => void
  addScreenshotSlot: (canvasId?: string) => string | null
  updateScreenshotSlot: (
    id: string,
    patch: Partial<ScreenshotSlot>,
    canvasId?: string
  ) => void
  setScreenshotSlotImage: (
    id: string,
    src: string | null,
    canvasId?: string
  ) => void
  deleteScreenshotSlot: (id: string, canvasId?: string) => void
  duplicateScreenshotSlot: (id: string, canvasId?: string) => string | null
  bringScreenshotSlotToFront: (id: string, canvasId?: string) => void
  sendScreenshotSlotToBack: (id: string, canvasId?: string) => void
  arrangeScreenshotSlotsInRow: (canvasId?: string) => void
  setScreenshotSlotGroupPosition: (
    position: { xPct: number; yPct: number },
    canvasId?: string
  ) => void
}

type EditorStore = {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  _lastGroup: string | null
  _lastTs: number
  isPreviewMode: boolean
  isPreviewAutoScroll: boolean
  previewAutoScrollDelay: number
  previewAnimation: "slide" | "fade" | "zoom" | "flip"
  bulkEditMode: boolean
  bulkCanvasDragging: boolean
  bulkViewportZoom: number
  bulkScale: number
  bulkFitViewSeq: number
  selectedTextId: string | null
  selectedAssetId: string | null
  selectedAnnotationShapeId: string | null
  selectedScreenshotSlotId: string | null
  isScreenshotSelected: boolean
  presetTab: "single" | "multi"
  activeLayoutPresetId: string | null
} & EditorActions

const computeNextZ = (items: { zIndex: number }[]) => {
  const max = items.length ? Math.max(...items.map((t) => t.zIndex)) : 0
  return Math.max(max + 1, 1)
}

const getLayerItems = (c: CanvasState) => [
  c.screenshotLayer,
  ...c.screenshotSlots,
  ...c.assets,
  ...c.texts,
  ...c.annotations.filter((stroke) => stroke.mode !== "eraser"),
  ...c.annotationShapes,
]

const computeNextLayerZ = (c: CanvasState) => computeNextZ(getLayerItems(c))

const getLayerRefs = (c: CanvasState) => [
  { key: "screenshot", zIndex: c.screenshotLayer.zIndex },
  ...c.screenshotSlots.map((slot) => ({
    key: `slot:${slot.id}`,
    zIndex: slot.zIndex,
  })),
  ...c.assets.map((asset) => ({
    key: `asset:${asset.id}`,
    zIndex: asset.zIndex,
  })),
  ...c.texts.map((text) => ({
    key: `text:${text.id}`,
    zIndex: text.zIndex,
  })),
  ...c.annotations.reduce<{ key: string; zIndex: number }[]>(
    (refs, stroke, index) => {
      if (stroke.mode !== "eraser") {
        refs.push({
          key: `annotation-stroke:${stroke.id}`,
          zIndex: stroke.zIndex ?? index + 1,
        })
      }
      return refs
    },
    []
  ),
  ...c.annotationShapes.map((shape) => ({
    key: `annotation:${shape.id}`,
    zIndex: shape.zIndex,
  })),
]

function applyLayerOrder(
  c: CanvasState,
  refsBottomFirst: { key: string; zIndex: number }[]
): Partial<CanvasState> {
  const zByKey = new Map(
    refsBottomFirst.map((layer, index) => [layer.key, index + 1])
  )
  return {
    screenshotLayer: {
      ...c.screenshotLayer,
      zIndex: zByKey.get("screenshot") ?? c.screenshotLayer.zIndex,
    },
    screenshotSlots: c.screenshotSlots.map((slot) => ({
      ...slot,
      zIndex: zByKey.get(`slot:${slot.id}`) ?? slot.zIndex,
    })),
    assets: c.assets.map((asset) => ({
      ...asset,
      zIndex: zByKey.get(`asset:${asset.id}`) ?? asset.zIndex,
    })),
    texts: c.texts.map((text) => ({
      ...text,
      zIndex: zByKey.get(`text:${text.id}`) ?? text.zIndex,
    })),
    annotations: c.annotations.map((stroke) => ({
      ...stroke,
      zIndex:
        stroke.mode !== "eraser"
          ? (zByKey.get(`annotation-stroke:${stroke.id}`) ?? stroke.zIndex)
          : stroke.zIndex,
    })),
    annotationShapes: c.annotationShapes.map((shape) => ({
      ...shape,
      zIndex: zByKey.get(`annotation:${shape.id}`) ?? shape.zIndex,
    })),
  }
}

function moveLayerInStack(
  c: CanvasState,
  key: string,
  position: "front" | "back"
): Partial<CanvasState> {
  const refs = getLayerRefs(c).sort((a, b) => a.zIndex - b.zIndex)
  const index = refs.findIndex((layer) => layer.key === key)
  if (index < 0) return {}
  const [target] = refs.splice(index, 1)
  if (position === "front") refs.push(target)
  else refs.unshift(target)
  return applyLayerOrder(c, refs)
}

const SLOT_DEFAULT_HEIGHT_PCT = 28
const SLOT_DEFAULT_FALLBACK_WIDTH = 60

const layoutSlotsInRow = (
  slots: ScreenshotSlot[],
  canvasFrame: DeviceFrame,
  canvasAspect: number,
  options: { preservePositions?: boolean } = {}
): ScreenshotSlot[] => {
  const n = slots.length
  if (n === 0) return slots
  const layout = computeRowLayout(
    [
      { id: "__main__", frame: canvasFrame },
      ...slots.map((slot) => ({ id: slot.id, frame: slot.frame })),
    ],
    canvasAspect
  )
  const slotLayoutById = new Map(
    layout.slice(1).map((entry) => [entry.id, entry])
  )
  return slots.map((slot) => {
    const entry = slotLayoutById.get(slot.id)
    if (!entry) return slot
    if (options.preservePositions) {
      return {
        ...slot,
        widthPct: entry.widthPct,
        heightPct: SLOT_DEFAULT_HEIGHT_PCT,
      }
    }
    return {
      ...slot,
      xPct: entry.xPct,
      yPct: 50,
      widthPct: entry.widthPct,
      heightPct: SLOT_DEFAULT_HEIGHT_PCT,
      rotation: 0,
    }
  })
}

const aspectRatioFromState = (aspect: AspectState): number => {
  const w = aspect.w || 16
  const h = aspect.h || 10
  return w / h
}

const stateCanvasAspect = (state: EditorState): number =>
  aspectRatioFromState(state.aspect)

function applySharedFrameToCanvas(
  canvas: CanvasState,
  state: EditorState,
  frame: DeviceFrame,
  options: { preservePositions?: boolean } = { preservePositions: true }
): Pick<CanvasState, "frame" | "screenshotSlots"> {
  const sharedFrame = { ...frame }
  const slots = canvas.screenshotSlots.map((slot) => ({
    ...slot,
    frame: { ...sharedFrame },
  }))

  return {
    frame: sharedFrame,
    screenshotSlots: layoutSlotsInRow(
      slots,
      sharedFrame,
      stateCanvasAspect(state),
      options
    ),
  }
}

const createScreenshotSlot = (
  base: Partial<ScreenshotSlot>,
  zIndex: number
): ScreenshotSlot => ({
  id: makeId(),
  src: null,
  xPct: 50,
  yPct: 50,
  widthPct: SLOT_DEFAULT_FALLBACK_WIDTH,
  heightPct: SLOT_DEFAULT_HEIGHT_PCT,
  rotation: 0,
  padding: 16,
  tilt: { rx: 0, ry: 0, rz: 0 },
  scale: 100,
  frame: {
    id: "none",
    color: "black",
    orientation: "vertical",
  },
  borderRadius: 7,
  zIndex,
  shadow: {
    type: "drop",
    intensity: 35,
    lightSource: "center",
    color: "#050505",
  },
  border: { color: null, width: 1, style: "solid", padding: 0 },
  enhance: "off",
  filter: "none",
  opacity: 100,
  blendMode: "normal",
  frameAddress: "",
  ...base,
})

const CANVAS_BASE_W = 1100
const CANVAS_GAP = 80

const clampPct = (value: number) => Math.max(-20, Math.min(120, value))

const canvasHeightFromAspectRatio = (canvasAspect: number) =>
  CANVAS_BASE_W / canvasAspect

const scaleScreenshotOffsetForAspectChange = (
  offset: { x: number; y: number },
  currentAspect: number,
  nextAspect: number
) => {
  const currentHeight = canvasHeightFromAspectRatio(currentAspect)
  const nextHeight = canvasHeightFromAspectRatio(nextAspect)
  if (!currentHeight || !nextHeight) return offset
  return {
    x: offset.x,
    y: offset.y * (nextHeight / currentHeight),
  }
}

/**
 * Place a new canvas adjacent to an existing canvas without overlap.
 * - With an explicit `sourceId`: place to the right of that canvas, then if
 *   that spot collides with any other canvas, fall back to the rightmost free
 *   slot in the grid.
 * - Without a source: place to the right of the visually-rightmost canvas.
 */
const placementAfterCanvas = (
  state: EditorState,
  sourceId?: string
): { x: number; y: number } => {
  if (state.canvases.length === 0) return { x: 0, y: 0 }

  const aw = state.aspect.w || 16
  const ah = state.aspect.h || 10
  const canvasW = CANVAS_BASE_W
  const canvasH = (CANVAS_BASE_W * ah) / aw
  const strideX = canvasW + CANVAS_GAP
  const strideY = canvasH + CANVAS_GAP

  const collidesWithExisting = (pos: { x: number; y: number }) =>
    state.canvases.some(
      (c) =>
        Math.abs(c.position.x - pos.x) < 1 && Math.abs(c.position.y - pos.y) < 1
    )

  // Anchor: the source canvas (when duplicating) or the rightmost canvas.
  const src = sourceId
    ? state.canvases.find((c) => c.id === sourceId)
    : state.canvases.reduce(
        (best, c) => (c.position.x > best.position.x ? c : best),
        state.canvases[0]
      )

  if (!src) {
    const rightmost = state.canvases.reduce(
      (max, c) => (c.position.x > max.position.x ? c : max),
      state.canvases[0]
    )
    return { x: rightmost.position.x + strideX, y: rightmost.position.y }
  }

  // First choice: directly to the right of the source.
  let candidate = { x: src.position.x + strideX, y: src.position.y }
  if (!collidesWithExisting(candidate)) return candidate

  // Otherwise, find the rightmost canvas overall and place after it.
  const rightmost = state.canvases.reduce(
    (max, c) => (c.position.x > max.position.x ? c : max),
    state.canvases[0]
  )
  candidate = { x: rightmost.position.x + strideX, y: rightmost.position.y }
  if (!collidesWithExisting(candidate)) return candidate

  // As a final fallback, drop one row below the source.
  return { x: src.position.x, y: src.position.y + strideY }
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const commit = (patch: SetPatch, group: string | null) => {
    const state = get()
    const resolvedPatch =
      typeof patch === "function" ? patch(state.present) : patch
    const present = { ...state.present, ...resolvedPatch }
    const now = Date.now()
    const canMerge =
      group !== null &&
      group === state._lastGroup &&
      now - state._lastTs < GROUP_MERGE_MS
    if (canMerge) {
      set({ present, future: [], _lastTs: now })
      return
    }
    const past = [...state.past, state.present]
    if (past.length > HISTORY_LIMIT) past.shift()
    set({
      past,
      present,
      future: [],
      _lastGroup: group,
      _lastTs: now,
    })
  }

  const commitCanvas = (
    targetId: string | undefined,
    patch: CanvasPatch,
    group: string | null
  ) => {
    commit((state) => {
      const canvasId = targetId ?? state.activeCanvasId
      const canvases = state.canvases.map((canvas) => {
        if (canvas.id !== canvasId) return canvas
        const resolvedPatch =
          typeof patch === "function" ? patch(canvas, state) : patch
        return { ...canvas, ...resolvedPatch }
      })
      return { canvases }
    }, group)
  }

  return {
    past: [],
    present: DEFAULT_STATE,
    future: [],
    _lastGroup: null,
    _lastTs: 0,
    isPreviewMode: false,
    isPreviewAutoScroll: false,
    previewAutoScrollDelay: 3000,
    previewAnimation: "slide" as const,
    bulkEditMode: false,
    bulkCanvasDragging: false,
    bulkViewportZoom: 1,
    bulkScale: 65,
    bulkFitViewSeq: 0,
    selectedTextId: null,
    selectedAssetId: null,
    selectedAnnotationShapeId: null,
    selectedScreenshotSlotId: null,
    isScreenshotSelected: false,
    presetTab: "single" as const,
    activeLayoutPresetId: null,

    setActiveTool: (t) => commit({ activeTool: t }, null),
    setPresetTab: (tab) => set({ presetTab: tab }),
    setActiveLayoutPresetId: (id) => set({ activeLayoutPresetId: id }),
    setScreenshot: (screenshot, canvasId) => {
      const state = get()
      const activeLayoutPreset = LAYOUT_PRESETS.find(
        (preset) => preset.id === state.activeLayoutPresetId
      )
      const aw = state.present.aspect.w || 16
      const ah = state.present.aspect.h || 10
      const canvasH = (CANVAS_BASE_W * ah) / aw
      const presetOffset =
        activeLayoutPreset && activeLayoutPreset.mainOffset
          ? {
              x: (activeLayoutPreset.mainOffset.xPct / 100) * CANVAS_BASE_W,
              y: (activeLayoutPreset.mainOffset.yPct / 100) * canvasH,
            }
          : { x: 0, y: 0 }
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshot,
          originalScreenshot: screenshot,
          lastCropRegion: null,
          screenshotPosition: "center",
          screenshotOffset: presetOffset,
          screenshotLayer: {
            ...canvas.screenshotLayer,
            zIndex:
              screenshot && !canvas.screenshot
                ? computeNextLayerZ(canvas)
                : canvas.screenshotLayer.zIndex,
            hidden: false,
          },
        }),
        null
      )
    },
    applyCroppedScreenshot: (s, region, canvasId) =>
      commitCanvas(
        canvasId,
        { screenshot: s, lastCropRegion: region },
        "applyCroppedScreenshot"
      ),
    setAspect: (a) => {
      const activeLayoutPreset = LAYOUT_PRESETS.find(
        (preset) => preset.id === get().activeLayoutPresetId
      )
      commit((state) => {
        const currentAspect = stateCanvasAspect(state)
        const nextAspect = aspectRatioFromState(a)
        const nextCanvasHeight = canvasHeightFromAspectRatio(nextAspect)

        return {
          aspect: a,
          canvases: state.canvases.map((canvas) => {
            const shouldReapplyActivePreset =
              activeLayoutPreset &&
              canvas.id === state.activeCanvasId &&
              canvas.screenshotSlots.length === activeLayoutPreset.slots.length
            let screenshotSlots = layoutSlotsInRow(
              canvas.screenshotSlots,
              canvas.frame,
              nextAspect,
              shouldReapplyActivePreset
                ? { preservePositions: true }
                : undefined
            )

            if (shouldReapplyActivePreset) {
              screenshotSlots = screenshotSlots.map((slot, index) => {
                const config = activeLayoutPreset.slots[index]
                if (!config) return slot
                return {
                  ...slot,
                  xPct: config.xPct,
                  yPct: config.yPct,
                  rotation: config.rotation,
                  tilt: config.tilt,
                  scale: config.scale,
                }
              })
            }

            const screenshotOffset = shouldReapplyActivePreset
              ? activeLayoutPreset.mainOffset
                ? {
                    x:
                      (activeLayoutPreset.mainOffset.xPct / 100) *
                      CANVAS_BASE_W,
                    y:
                      (activeLayoutPreset.mainOffset.yPct / 100) *
                      nextCanvasHeight,
                  }
                : { x: 0, y: 0 }
              : scaleScreenshotOffsetForAspectChange(
                  canvas.screenshotOffset,
                  currentAspect,
                  nextAspect
                )

            return {
              ...canvas,
              tilt: shouldReapplyActivePreset
                ? activeLayoutPreset.canvasTilt
                : canvas.tilt,
              scale: shouldReapplyActivePreset
                ? activeLayoutPreset.canvasScale
                : canvas.scale,
              screenshotOffset,
              screenshotSlots,
            }
          }),
        }
      }, "aspect")
    },
    setBackground: (b, canvasId) =>
      commitCanvas(canvasId, { background: b }, "background"),
    setPadding: (n, canvasId) =>
      commitCanvas(canvasId, { padding: n }, "padding"),
    setBorderRadius: (n, canvasId) =>
      commitCanvas(canvasId, { borderRadius: n }, "borderRadius"),
    setCanvasBorderRadius: (n, canvasId) =>
      commitCanvas(canvasId, { canvasBorderRadius: n }, "canvasBorderRadius"),
    setBorder: (b, canvasId) => commitCanvas(canvasId, { border: b }, "border"),
    setBackdropEffects: (e, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, effects: e } }),
        "backdrop-effects"
      ),
    setBackdropPattern: (p, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, pattern: p } }),
        "backdrop-pattern"
      ),
    setBackdropFilter: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, filter: f } }),
        "backdrop-filter"
      ),
    setTilt: (t, canvasId) => commitCanvas(canvasId, { tilt: t }, "tilt"),
    setScale: (n, canvasId) => commitCanvas(canvasId, { scale: n }, "scale"),
    setTiltAndScale: (t, scale, canvasId) =>
      commitCanvas(canvasId, { tilt: t, scale }, "tilt-scale"),
    setCanvasZoom: (n) => commit({ canvasZoom: n }, "canvasZoom"),
    setScreenshotPosition: (p, canvasId) =>
      commitCanvas(
        canvasId,
        { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
        "screenshotPosition"
      ),
    setScreenshotOffset: (o, canvasId) =>
      commitCanvas(canvasId, { screenshotOffset: o }, "screenshotOffset"),
    setScreenshotPlacement: (p, o, canvasId) =>
      commitCanvas(
        canvasId,
        { screenshotPosition: p, screenshotOffset: o },
        "screenshotPlacement"
      ),
    updateScreenshotLayer: (patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotLayer: { ...canvas.screenshotLayer, ...patch },
        }),
        "screenshotLayer"
      ),
    setShadow: (s, canvasId) => commitCanvas(canvasId, { shadow: s }, "shadow"),
    setOverlay: (o, canvasId) =>
      commitCanvas(canvasId, { overlay: o }, "overlay"),
    setFrame: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => applySharedFrameToCanvas(canvas, state, f),
        "frame"
      ),
    setFrameForMatchingScreenshots: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => applySharedFrameToCanvas(canvas, state, f),
        "frame"
      ),
    setFrameAddress: (address, canvasId) =>
      commitCanvas(canvasId, { frameAddress: address }, "frame-address"),
    setObjectFit: (fit, canvasId) =>
      commitCanvas(canvasId, { objectFit: fit }, "objectFit"),
    bringScreenshotToFront: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, "screenshot", "front"),
        "screenshot-layer"
      ),
    sendScreenshotToBack: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, "screenshot", "back"),
        "screenshot-layer"
      ),
    setPortrait: (p, canvasId) =>
      commitCanvas(canvasId, { portrait: p }, "portrait"),
    setEnhance: (e, canvasId) =>
      commitCanvas(canvasId, { enhance: e }, "enhance"),
    setAnnotation: (patch) =>
      commit(
        (state) => ({ annotation: { ...state.annotation, ...patch } }),
        "annotation"
      ),

    addAnnotationStroke: (stroke, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: [
            ...canvas.annotations,
            { ...stroke, id, zIndex: computeNextLayerZ(canvas) },
          ],
        }),
        `annotation-stroke-${id}`
      )
      return id
    },
    updateAnnotationStroke: (id, points, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.map((stroke) =>
            stroke.id === id ? { ...stroke, points } : stroke
          ),
        }),
        `annotation-stroke-${id}`
      ),
    updateAnnotationStrokeLayer: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.map((stroke) =>
            stroke.id === id ? { ...stroke, ...patch } : stroke
          ),
        }),
        `annotation-stroke-${id}`
      ),
    deleteAnnotationStroke: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotations: canvas.annotations.filter((stroke) => stroke.id !== id),
        }),
        null
      ),

    addAnnotationShape: (shape, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: [
            ...canvas.annotationShapes,
            { ...shape, id, zIndex: computeNextLayerZ(canvas) },
          ],
        }),
        null
      )
      return id
    },
    updateAnnotationShape: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: canvas.annotationShapes.map((shape) =>
            shape.id === id ? { ...shape, ...patch } : shape
          ),
        }),
        `annotation-shape-${id}`
      ),
    deleteAnnotationShape: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          annotationShapes: canvas.annotationShapes.filter(
            (shape) => shape.id !== id
          ),
        }),
        null
      ),
    duplicateAnnotationShape: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const src = canvas.annotationShapes.find((shape) => shape.id === id)
          if (!src) return { annotationShapes: canvas.annotationShapes }
          didCopy = true
          const copy: AnnotationShape = {
            ...src,
            id: copyId,
            xPct: Math.min(98, src.xPct + 3),
            yPct: Math.min(98, src.yPct + 3),
            zIndex: computeNextLayerZ(canvas),
          }
          return { annotationShapes: [...canvas.annotationShapes, copy] }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAnnotationShapeToFront: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `annotation:${id}`, "front"),
        null
      ),
    sendAnnotationShapeToBack: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `annotation:${id}`, "back"),
        null
      ),
    clearAnnotations: (canvasId) =>
      commitCanvas(canvasId, { annotations: [], annotationShapes: [] }, null),

    addText: (canvasId) => {
      const id = makeId()
      const state = get()
      const aw = state.present.aspect.w || 16
      const ah = state.present.aspect.h || 10
      const canvasW = CANVAS_BASE_W
      const canvasH = (CANVAS_BASE_W * ah) / aw
      const defaultFontSize = Math.round(
        Math.min(96, Math.max(18, Math.max(canvasW, canvasH) * 0.028))
      )
      commitCanvas(
        canvasId,
        (canvas) => ({
          texts: [
            ...canvas.texts,
            {
              id,
              content: "Double-click to edit",
              xPct: 50,
              yPct: 85,
              rotation: 0,
              fontSize: defaultFontSize,
              fontFamily: FONT_FAMILIES[0].css,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: 0,
              color: "#ffffff",
              align: "left",
              borderColor: null,
              borderWidth: 1,
              borderStyle: "solid",
              zIndex: computeNextLayerZ(canvas),
              widthPx: null,
              heightPx: null,
              autoColor: true,
              opacity: 100,
              blendMode: "normal",
            },
          ],
        }),
        null
      )
      return id
    },
    updateText: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          texts: canvas.texts.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }),
        `text-${id}`
      ),
    deleteText: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ texts: canvas.texts.filter((t) => t.id !== id) }),
        null
      ),
    duplicateText: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const src = canvas.texts.find((t) => t.id === id)
          if (!src) return { texts: canvas.texts }
          didCopy = true
          const copy: TextElement = {
            ...src,
            id: copyId,
            xPct: Math.min(95, src.xPct + 4),
            yPct: Math.min(95, src.yPct + 4),
            zIndex: computeNextLayerZ(canvas),
          }
          return { texts: [...canvas.texts, copy] }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringTextToFront: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `text:${id}`, "front"),
        null
      ),
    sendTextToBack: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `text:${id}`, "back"),
        null
      ),
    setSelectedTextId: (id) => set({ selectedTextId: id }),

    addAsset: (src, canvasId) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => ({
          assets: [
            ...canvas.assets,
            {
              id,
              src,
              xPct: 50,
              yPct: 50,
              widthPct: 25,
              heightPct: null,
              rotation: 0,
              zIndex: computeNextLayerZ(canvas),
              opacity: 100,
              filter: "none",
              blendMode: "normal",
              hidden: false,
            },
          ],
        }),
        null
      )
      return id
    },
    updateAsset: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          assets: canvas.assets.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        }),
        `asset-${id}`
      ),
    deleteAsset: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ assets: canvas.assets.filter((a) => a.id !== id) }),
        null
      ),
    duplicateAsset: (id, canvasId) => {
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        canvasId,
        (canvas) => {
          const src = canvas.assets.find((a) => a.id === id)
          if (!src) return { assets: canvas.assets }
          didCopy = true
          const copy: AssetElement = {
            ...src,
            id: copyId,
            xPct: Math.min(95, src.xPct + 4),
            yPct: Math.min(95, src.yPct + 4),
            zIndex: computeNextLayerZ(canvas),
          }
          return { assets: [...canvas.assets, copy] }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAssetToFront: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `asset:${id}`, "front"),
        null
      ),
    sendAssetToBack: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `asset:${id}`, "back"),
        null
      ),
    setSelectedAssetId: (id) => set({ selectedAssetId: id }),
    setSelectedAnnotationShapeId: (id) =>
      set({ selectedAnnotationShapeId: id }),
    setSelectedScreenshotSlotId: (id) => set({ selectedScreenshotSlotId: id }),
    setIsScreenshotSelected: (selected) =>
      set({ isScreenshotSelected: selected }),
    setIsPreviewMode: (p) => set({ isPreviewMode: p }),
    setIsPreviewAutoScroll: (a) => set({ isPreviewAutoScroll: a }),
    setPreviewAnimation: (a) => set({ previewAnimation: a }),
    setPreviewAutoScrollDelay: (d) => set({ previewAutoScrollDelay: d }),
    setBulkEditMode: (b) => {
      if (!b) {
        // Reset all canvas positions to center when disabling bulk edit
        commit(
          (state) => ({
            canvases: state.canvases.map((c) => ({
              ...c,
              position: { x: 0, y: 0 },
            })),
          }),
          null
        )
      }
      set({ bulkEditMode: b, bulkCanvasDragging: false, bulkViewportZoom: 1 })
    },
    setBulkCanvasDragging: (dragging) => set({ bulkCanvasDragging: dragging }),
    setBulkViewportZoom: (zoom) =>
      set({ bulkViewportZoom: Math.max(0.05, Math.min(2, zoom)) }),
    setBulkScale: (n) => set({ bulkScale: Math.max(20, Math.min(100, n)) }),

    undo: () => {
      const state = get()
      if (!state.past.length) return
      const prev = state.past[state.past.length - 1]
      set({
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        _lastGroup: null,
        _lastTs: 0,
        bulkEditMode: prev.canvases.length > 1,
      })
    },
    redo: () => {
      const state = get()
      if (!state.future.length) return
      const next = state.future[0]
      set({
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        _lastGroup: null,
        _lastTs: 0,
        bulkEditMode: next.canvases.length > 1,
      })
    },
    reset: () => {
      const state = get()
      set({
        past: [...state.past, state.present],
        present: DEFAULT_STATE,
        future: [],
        _lastGroup: null,
        _lastTs: 0,
        bulkCanvasDragging: false,
        bulkViewportZoom: 1,
      })
    },
    addCanvas: () => {
      if (get().present.canvases.length >= MAX_CANVASES) return null
      const id = makeId()
      commit((state) => {
        const newCanvas = createCanvas(id, placementAfterCanvas(state))
        return {
          canvases: [...state.canvases, newCanvas],
          activeCanvasId: id,
        }
      }, null)
      set((s) => ({
        selectedTextId: null,
        selectedAssetId: null,
        selectedAnnotationShapeId: null,
        selectedScreenshotSlotId: null,
        isScreenshotSelected: false,
        bulkEditMode: true,
        bulkCanvasDragging: false,
        bulkViewportZoom: 1,
        bulkFitViewSeq: s.bulkFitViewSeq + 1,
      }))
      return id
    },
    removeCanvas: (id) => {
      commit((state) => {
        if (state.canvases.length <= 1) return {}
        const remaining = state.canvases.filter((c) => c.id !== id)
        const activeCanvasId =
          state.activeCanvasId === id
            ? (remaining[0]?.id ?? state.activeCanvasId)
            : state.activeCanvasId
        return { canvases: remaining, activeCanvasId }
      }, null)
      set({
        selectedTextId: null,
        selectedAssetId: null,
        selectedAnnotationShapeId: null,
        selectedScreenshotSlotId: null,
        isScreenshotSelected: false,
      })
    },
    duplicateCanvas: (sourceId) => {
      if (get().present.canvases.length >= MAX_CANVASES) return null
      const newId = makeId()
      let didCopy = false
      commit((state) => {
        const targetId = sourceId ?? state.activeCanvasId
        const srcIndex = state.canvases.findIndex((c) => c.id === targetId)
        if (srcIndex < 0) return {}
        didCopy = true
        const src = state.canvases[srcIndex]
        const copy: CanvasState = {
          ...src,
          id: newId,
          position: placementAfterCanvas(state, src.id),
        }
        // Insert the copy right after the source canvas
        const canvases = [...state.canvases]
        canvases.splice(srcIndex + 1, 0, copy)
        return {
          canvases,
          activeCanvasId: newId,
        }
      }, null)
      if (didCopy) {
        set((s) => ({ bulkFitViewSeq: s.bulkFitViewSeq + 1 }))
      }
      return didCopy ? newId : null
    },
    setActiveCanvasId: (id) => {
      const state = get()
      if (state.present.activeCanvasId === id) return
      commit({ activeCanvasId: id }, null)
      set({
        selectedTextId: null,
        selectedAssetId: null,
        selectedAnnotationShapeId: null,
        selectedScreenshotSlotId: null,
        isScreenshotSelected: false,
      })
    },
    setCanvasPosition: (id, position) => {
      commit(
        (state) => ({
          canvases: state.canvases.map((c) =>
            c.id === id ? { ...c, position } : c
          ),
        }),
        `canvasPosition-${id}`
      )
    },
    setCanvasPositions: (positions) => {
      commit(
        (state) => ({
          canvases: state.canvases.map((c) =>
            positions[c.id] ? { ...c, position: positions[c.id] } : c
          ),
        }),
        null
      )
    },
    requestBulkFitView: () =>
      set((s) => ({ bulkFitViewSeq: s.bulkFitViewSeq + 1 })),

    addScreenshotSlot: (canvasId) => {
      const targetId = canvasId ?? get().present.activeCanvasId
      const target = get().present.canvases.find(
        (canvas) => canvas.id === targetId
      )
      if (!target || target.screenshotSlots.length >= MAX_SCREENSHOT_SLOTS) {
        return null
      }
      const id = makeId()
      commitCanvas(
        targetId,
        (canvas, state) => {
          const next = createScreenshotSlot(
            {
              id,
              frame: { ...canvas.frame },
              frameAddress: canvas.frameAddress,
              padding: canvas.padding,
              tilt: { ...canvas.tilt },
              scale: canvas.scale,
              borderRadius: canvas.borderRadius,
              shadow: { ...canvas.shadow },
              border: { ...canvas.border },
              enhance: canvas.enhance,
              opacity: canvas.screenshotLayer.opacity,
              blendMode: canvas.screenshotLayer.blendMode,
            },
            computeNextLayerZ(canvas)
          )
          const syncedSlots = canvas.screenshotSlots.map((slot) => ({
            ...slot,
            frame: { ...canvas.frame },
          }))
          return {
            screenshotSlots: layoutSlotsInRow(
              [...syncedSlots, next],
              canvas.frame,
              stateCanvasAspect(state)
            ),
          }
        },
        null
      )
      return id
    },
    updateScreenshotSlot: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => {
          if (patch.frame) {
            const sharedFrame = { ...patch.frame }
            const updated = canvas.screenshotSlots.map((slot) =>
              slot.id === id
                ? { ...slot, ...patch, frame: { ...sharedFrame } }
                : { ...slot, frame: { ...sharedFrame } }
            )
            return {
              frame: sharedFrame,
              screenshotSlots: layoutSlotsInRow(
                updated,
                sharedFrame,
                stateCanvasAspect(state),
                { preservePositions: true }
              ),
            }
          }
          const updated = canvas.screenshotSlots.map((slot) =>
            slot.id === id ? { ...slot, ...patch } : slot
          )
          return { screenshotSlots: updated }
        },
        `screenshot-slot-${id}`
      ),
    setScreenshotSlotImage: (id, src, canvasId) => {
      const activeLayoutPreset = LAYOUT_PRESETS.find(
        (preset) => preset.id === get().activeLayoutPresetId
      )
      commitCanvas(
        canvasId,
        (canvas) => {
          const updatedSlots = canvas.screenshotSlots.map((slot) =>
            slot.id === id ? { ...slot, src } : slot
          )
          if (
            !activeLayoutPreset ||
            updatedSlots.length !== activeLayoutPreset.slots.length
          ) {
            return { screenshotSlots: updatedSlots }
          }
          return {
            screenshotSlots: updatedSlots.map((slot, index) => {
              const config = activeLayoutPreset.slots[index]
              if (!config) return slot
              return {
                ...slot,
                xPct: config.xPct,
                yPct: config.yPct,
                rotation: config.rotation,
                tilt: config.tilt,
                scale: config.scale,
              }
            }),
          }
        },
        null
      )
    },
    deleteScreenshotSlot: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => ({
          screenshotSlots: layoutSlotsInRow(
            canvas.screenshotSlots.filter((slot) => slot.id !== id),
            canvas.frame,
            stateCanvasAspect(state)
          ),
        }),
        null
      ),
    duplicateScreenshotSlot: (id, canvasId) => {
      const targetId = canvasId ?? get().present.activeCanvasId
      const target = get().present.canvases.find(
        (canvas) => canvas.id === targetId
      )
      if (!target || target.screenshotSlots.length >= MAX_SCREENSHOT_SLOTS) {
        return null
      }
      const copyId = makeId()
      let didCopy = false
      commitCanvas(
        targetId,
        (canvas, state) => {
          const src = canvas.screenshotSlots.find((slot) => slot.id === id)
          if (!src) return { screenshotSlots: canvas.screenshotSlots }
          didCopy = true
          const copy: ScreenshotSlot = {
            ...src,
            id: copyId,
            frame: { ...canvas.frame },
            zIndex: computeNextLayerZ(canvas),
          }
          const syncedSlots = canvas.screenshotSlots.map((slot) => ({
            ...slot,
            frame: { ...canvas.frame },
          }))
          return {
            screenshotSlots: layoutSlotsInRow(
              [...syncedSlots, copy],
              canvas.frame,
              stateCanvasAspect(state)
            ),
          }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringScreenshotSlotToFront: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `slot:${id}`, "front"),
        `slot-layer-${id}`
      ),
    sendScreenshotSlotToBack: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, `slot:${id}`, "back"),
        `slot-layer-${id}`
      ),
    arrangeScreenshotSlotsInRow: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => ({
          screenshotSlots: layoutSlotsInRow(
            canvas.screenshotSlots,
            canvas.frame,
            stateCanvasAspect(state)
          ),
        }),
        null
      ),
    setScreenshotSlotGroupPosition: (position, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          if (canvas.screenshotSlots.length === 0) {
            return { screenshotSlots: canvas.screenshotSlots }
          }

          const bounds = canvas.screenshotSlots.reduce(
            (acc, slot) => ({
              minX: Math.min(acc.minX, slot.xPct - slot.widthPct / 2),
              maxX: Math.max(acc.maxX, slot.xPct + slot.widthPct / 2),
              minY: Math.min(acc.minY, slot.yPct - slot.heightPct / 2),
              maxY: Math.max(acc.maxY, slot.yPct + slot.heightPct / 2),
            }),
            {
              minX: Number.POSITIVE_INFINITY,
              maxX: Number.NEGATIVE_INFINITY,
              minY: Number.POSITIVE_INFINITY,
              maxY: Number.NEGATIVE_INFINITY,
            }
          )
          const centerX = (bounds.minX + bounds.maxX) / 2
          const centerY = (bounds.minY + bounds.maxY) / 2
          const dx = position.xPct - centerX
          const dy = position.yPct - centerY

          return {
            screenshotSlots: canvas.screenshotSlots.map((slot) => ({
              ...slot,
              xPct: clampPct(slot.xPct + dx),
              yPct: clampPct(slot.yPct + dy),
            })),
          }
        },
        "screenshot-slot-group-position"
      ),
  }
})

const CanvasIdContext = React.createContext<string | null>(null)

export function CanvasScope({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <CanvasIdContext.Provider value={id}>{children}</CanvasIdContext.Provider>
  )
}

export function useCanvasScopeId() {
  return React.useContext(CanvasIdContext)
}

export function useActiveCanvasId() {
  return useEditorStore((s) => s.present.activeCanvasId)
}

export function useCanvases() {
  return useEditorStore((s) => s.present.canvases)
}

export function useCanvasById(id: string): CanvasState | undefined {
  return useEditorStore((s) => s.present.canvases.find((c) => c.id === id))
}

export function useSelectedScreenshotSlot(): ScreenshotSlot | null {
  const selectedId = useEditorStore((s) => s.selectedScreenshotSlotId)
  return useActiveCanvasField((canvas) =>
    selectedId
      ? (canvas.screenshotSlots.find((slot) => slot.id === selectedId) ?? null)
      : null
  )
}

const FALLBACK_CANVAS: CanvasState = {
  ...DEFAULT_CANVAS_BASE,
  id: "__fallback__",
  position: { x: 0, y: 0 },
}

export function useActiveCanvasField<T>(
  selector: (canvas: CanvasState) => T
): T {
  const scopeId = React.useContext(CanvasIdContext)
  return useEditorStore((s) => {
    const id = scopeId ?? s.present.activeCanvasId
    const canvas =
      s.present.canvases.find((c) => c.id === id) ??
      s.present.canvases[0] ??
      FALLBACK_CANVAS
    return selector(canvas)
  })
}

export type EditorContext = Omit<EditorState, "canvases"> &
  CanvasState &
  EditorActions & {
    isPreviewMode: boolean
    isPreviewAutoScroll: boolean
    previewAutoScrollDelay: number
    previewAnimation: "slide" | "fade" | "zoom" | "flip"
    bulkEditMode: boolean
    bulkCanvasDragging: boolean
    bulkViewportZoom: number
    bulkScale: number
    selectedTextId: string | null
    selectedAssetId: string | null
    selectedAnnotationShapeId: string | null
    selectedScreenshotSlotId: string | null
    isScreenshotSelected: boolean
    canUndo: boolean
    canRedo: boolean
    canvases: CanvasState[]
    canvasScopeId: string
    canvasCount: number
  }

export function useEditor(): EditorContext {
  const scopeId = React.useContext(CanvasIdContext)
  const activeCanvasId = useEditorStore((s) => s.present.activeCanvasId)
  const targetId = scopeId ?? activeCanvasId
  const activeTool = useEditorStore((s) => s.present.activeTool)
  const aspect = useEditorStore((s) => s.present.aspect)
  const canvasZoom = useEditorStore((s) => s.present.canvasZoom)
  const annotation = useEditorStore((s) => s.present.annotation)
  const canvas = useActiveCanvasField((c) => c)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)
  const isPreviewAutoScroll = useEditorStore((s) => s.isPreviewAutoScroll)
  const previewAutoScrollDelay = useEditorStore((s) => s.previewAutoScrollDelay)
  const previewAnimation = useEditorStore((s) => s.previewAnimation)
  const bulkEditMode = useEditorStore((s) => s.bulkEditMode)
  const bulkCanvasDragging = useEditorStore((s) => s.bulkCanvasDragging)
  const bulkViewportZoom = useEditorStore((s) => s.bulkViewportZoom)
  const bulkScale = useEditorStore((s) => s.bulkScale)
  const selectedTextId = useEditorStore((s) => s.selectedTextId)
  const selectedAssetId = useEditorStore((s) => s.selectedAssetId)
  const selectedAnnotationShapeId = useEditorStore(
    (s) => s.selectedAnnotationShapeId
  )
  const selectedScreenshotSlotId = useEditorStore(
    (s) => s.selectedScreenshotSlotId
  )
  const isScreenshotSelected = useEditorStore((s) => s.isScreenshotSelected)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const canvasCount = useEditorStore((s) => s.present.canvases.length)
  const store = useEditorStore.getState()

  return {
    // shared editor state
    activeTool,
    aspect,
    canvasZoom,
    annotation,
    canvases: store.present.canvases,
    activeCanvasId,
    canvasScopeId: canvas.id,

    // flattened canvas state
    id: canvas.id,
    position: canvas.position,
    screenshot: canvas.screenshot,
    originalScreenshot: canvas.originalScreenshot,
    lastCropRegion: canvas.lastCropRegion,
    background: canvas.background,
    padding: canvas.padding,
    borderRadius: canvas.borderRadius,
    canvasBorderRadius: canvas.canvasBorderRadius,
    border: canvas.border,
    backdrop: canvas.backdrop,
    tilt: canvas.tilt,
    scale: canvas.scale,
    screenshotPosition: canvas.screenshotPosition,
    screenshotOffset: canvas.screenshotOffset,
    screenshotLayer: canvas.screenshotLayer,
    shadow: canvas.shadow,
    overlay: canvas.overlay,
    frame: canvas.frame,
    frameAddress: canvas.frameAddress,
    portrait: canvas.portrait,
    texts: canvas.texts,
    assets: canvas.assets,
    enhance: canvas.enhance,
    annotations: canvas.annotations,
    annotationShapes: canvas.annotationShapes,
    screenshotSlots: canvas.screenshotSlots,
    objectFit: canvas.objectFit,

    isPreviewMode,
    isPreviewAutoScroll,
    previewAutoScrollDelay,
    previewAnimation,
    bulkEditMode,
    bulkCanvasDragging,
    bulkViewportZoom,
    bulkScale,
    selectedTextId,
    selectedAssetId,
    selectedAnnotationShapeId,
    selectedScreenshotSlotId,
    isScreenshotSelected,
    canUndo,
    canRedo,

    setActiveTool: store.setActiveTool,
    setPresetTab: store.setPresetTab,
    setActiveLayoutPresetId: store.setActiveLayoutPresetId,
    setScreenshot: (s, canvasId) =>
      store.setScreenshot(s, canvasId ?? targetId),
    applyCroppedScreenshot: (s, region, canvasId) =>
      store.applyCroppedScreenshot(s, region, canvasId ?? targetId),
    setAspect: store.setAspect,
    setBackground: (b, canvasId) =>
      store.setBackground(b, canvasId ?? targetId),
    setPadding: (n, canvasId) => store.setPadding(n, canvasId ?? targetId),
    setBorderRadius: (n, canvasId) =>
      store.setBorderRadius(n, canvasId ?? targetId),
    setCanvasBorderRadius: (n, canvasId) =>
      store.setCanvasBorderRadius(n, canvasId ?? targetId),
    setBorder: (b, canvasId) => store.setBorder(b, canvasId ?? targetId),
    setBackdropEffects: (e, canvasId) =>
      store.setBackdropEffects(e, canvasId ?? targetId),
    setBackdropPattern: (p, canvasId) =>
      store.setBackdropPattern(p, canvasId ?? targetId),
    setBackdropFilter: (f, canvasId) =>
      store.setBackdropFilter(f, canvasId ?? targetId),
    setTilt: (t, canvasId) => store.setTilt(t, canvasId ?? targetId),
    setScale: (n, canvasId) => store.setScale(n, canvasId ?? targetId),
    setTiltAndScale: (t, scale, canvasId) =>
      store.setTiltAndScale(t, scale, canvasId ?? targetId),
    setCanvasZoom: store.setCanvasZoom,
    setScreenshotPosition: (p, canvasId) =>
      store.setScreenshotPosition(p, canvasId ?? targetId),
    setScreenshotOffset: (o, canvasId) =>
      store.setScreenshotOffset(o, canvasId ?? targetId),
    setScreenshotPlacement: (p, o, canvasId) =>
      store.setScreenshotPlacement(p, o, canvasId ?? targetId),
    updateScreenshotLayer: (patch, canvasId) =>
      store.updateScreenshotLayer(patch, canvasId ?? targetId),
    setShadow: (s, canvasId) => store.setShadow(s, canvasId ?? targetId),
    setOverlay: (o, canvasId) => store.setOverlay(o, canvasId ?? targetId),
    setFrame: (f, canvasId) => store.setFrame(f, canvasId ?? targetId),
    setFrameForMatchingScreenshots: (f, canvasId) =>
      store.setFrameForMatchingScreenshots(f, canvasId ?? targetId),
    setObjectFit: (fit, canvasId) =>
      store.setObjectFit(fit, canvasId ?? targetId),
    setFrameAddress: (address, canvasId) =>
      store.setFrameAddress(address, canvasId ?? targetId),
    bringScreenshotToFront: (canvasId) =>
      store.bringScreenshotToFront(canvasId ?? targetId),
    sendScreenshotToBack: (canvasId) =>
      store.sendScreenshotToBack(canvasId ?? targetId),
    setPortrait: (p, canvasId) => store.setPortrait(p, canvasId ?? targetId),
    setEnhance: (e, canvasId) => store.setEnhance(e, canvasId ?? targetId),
    setAnnotation: store.setAnnotation,
    addAnnotationStroke: (stroke, canvasId) =>
      store.addAnnotationStroke(stroke, canvasId ?? targetId),
    updateAnnotationStroke: (id, points, canvasId) =>
      store.updateAnnotationStroke(id, points, canvasId ?? targetId),
    updateAnnotationStrokeLayer: (id, patch, canvasId) =>
      store.updateAnnotationStrokeLayer(id, patch, canvasId ?? targetId),
    deleteAnnotationStroke: (id, canvasId) =>
      store.deleteAnnotationStroke(id, canvasId ?? targetId),
    addAnnotationShape: (shape, canvasId) =>
      store.addAnnotationShape(shape, canvasId ?? targetId),
    updateAnnotationShape: (id, patch, canvasId) =>
      store.updateAnnotationShape(id, patch, canvasId ?? targetId),
    deleteAnnotationShape: (id, canvasId) =>
      store.deleteAnnotationShape(id, canvasId ?? targetId),
    duplicateAnnotationShape: (id, canvasId) =>
      store.duplicateAnnotationShape(id, canvasId ?? targetId),
    bringAnnotationShapeToFront: (id, canvasId) =>
      store.bringAnnotationShapeToFront(id, canvasId ?? targetId),
    sendAnnotationShapeToBack: (id, canvasId) =>
      store.sendAnnotationShapeToBack(id, canvasId ?? targetId),
    clearAnnotations: (canvasId) =>
      store.clearAnnotations(canvasId ?? targetId),
    addText: (canvasId) => store.addText(canvasId ?? targetId),
    updateText: (id, patch, canvasId) =>
      store.updateText(id, patch, canvasId ?? targetId),
    deleteText: (id, canvasId) => store.deleteText(id, canvasId ?? targetId),
    duplicateText: (id, canvasId) =>
      store.duplicateText(id, canvasId ?? targetId),
    bringTextToFront: (id, canvasId) =>
      store.bringTextToFront(id, canvasId ?? targetId),
    sendTextToBack: (id, canvasId) =>
      store.sendTextToBack(id, canvasId ?? targetId),
    setSelectedTextId: store.setSelectedTextId,
    addAsset: (src, canvasId) => store.addAsset(src, canvasId ?? targetId),
    updateAsset: (id, patch, canvasId) =>
      store.updateAsset(id, patch, canvasId ?? targetId),
    deleteAsset: (id, canvasId) => store.deleteAsset(id, canvasId ?? targetId),
    duplicateAsset: (id, canvasId) =>
      store.duplicateAsset(id, canvasId ?? targetId),
    bringAssetToFront: (id, canvasId) =>
      store.bringAssetToFront(id, canvasId ?? targetId),
    sendAssetToBack: (id, canvasId) =>
      store.sendAssetToBack(id, canvasId ?? targetId),
    setSelectedAssetId: store.setSelectedAssetId,
    setSelectedAnnotationShapeId: store.setSelectedAnnotationShapeId,
    setSelectedScreenshotSlotId: store.setSelectedScreenshotSlotId,
    setIsScreenshotSelected: store.setIsScreenshotSelected,
    setIsPreviewMode: store.setIsPreviewMode,
    setIsPreviewAutoScroll: store.setIsPreviewAutoScroll,
    setPreviewAutoScrollDelay: store.setPreviewAutoScrollDelay,
    setPreviewAnimation: store.setPreviewAnimation,
    setBulkEditMode: store.setBulkEditMode,
    setBulkCanvasDragging: store.setBulkCanvasDragging,
    setBulkViewportZoom: store.setBulkViewportZoom,
    setBulkScale: store.setBulkScale,
    reset: store.reset,
    undo: store.undo,
    redo: store.redo,
    addCanvas: store.addCanvas,
    removeCanvas: store.removeCanvas,
    duplicateCanvas: store.duplicateCanvas,
    setActiveCanvasId: store.setActiveCanvasId,
    setCanvasPosition: store.setCanvasPosition,
    setCanvasPositions: store.setCanvasPositions,
    requestBulkFitView: store.requestBulkFitView,
    addScreenshotSlot: (canvasId) =>
      store.addScreenshotSlot(canvasId ?? targetId),
    updateScreenshotSlot: (id, patch, canvasId) =>
      store.updateScreenshotSlot(id, patch, canvasId ?? targetId),
    setScreenshotSlotImage: (id, src, canvasId) =>
      store.setScreenshotSlotImage(id, src, canvasId ?? targetId),
    deleteScreenshotSlot: (id, canvasId) =>
      store.deleteScreenshotSlot(id, canvasId ?? targetId),
    duplicateScreenshotSlot: (id, canvasId) =>
      store.duplicateScreenshotSlot(id, canvasId ?? targetId),
    bringScreenshotSlotToFront: (id, canvasId) =>
      store.bringScreenshotSlotToFront(id, canvasId ?? targetId),
    sendScreenshotSlotToBack: (id, canvasId) =>
      store.sendScreenshotSlotToBack(id, canvasId ?? targetId),
    arrangeScreenshotSlotsInRow: (canvasId) =>
      store.arrangeScreenshotSlotsInRow(canvasId ?? targetId),
    setScreenshotSlotGroupPosition: (position, canvasId) =>
      store.setScreenshotSlotGroupPosition(position, canvasId ?? targetId),
    canvasCount,
  }
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true
      if (isEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault()
        if (e.shiftKey) useEditorStore.getState().redo()
        else useEditorStore.getState().undo()
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return <>{children}</>
}
