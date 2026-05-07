"use client"

import * as React from "react"
import { create } from "zustand"

import { FONT_FAMILIES } from "./fonts"
import { DEFAULT_IMAGE_BACKGROUND } from "./presets"
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
  CropRegion,
  DeviceFrame,
  EditorState,
  EditorTool,
  EnhancePreset,
  Overlay,
  Portrait,
  ScreenshotLayer,
  ScreenshotPosition,
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
  shadowCss,
} from "./css-utils"
export {
  dynamicPatternColors,
  generateAutoGradients,
  pickContrastColor,
  pickContrastColorAtPosition,
  sampleImageColors,
  sampleImageColorsRaw,
} from "./color-utils"

const DEFAULT_STATE: EditorState = {
  activeTool: "pointer",
  screenshot: null,
  originalScreenshot: null,
  lastCropRegion: null,
  aspect: { id: "auto", w: 0, h: 0 },
  background: {
    type: "image",
    value: DEFAULT_IMAGE_BACKGROUND,
  },
  padding: 96,
  borderRadius: 12,
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
  canvasZoom: 100,
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
  screenshotLayer: {
    zIndex: 1,
    opacity: 100,
    blendMode: "normal",
    hidden: false,
  },
  shadow: {
    type: "drop",
    intensity: 40,
    lightSource: "center",
    color: "#000000",
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
  },
  texts: [],
  assets: [],
  enhance: "off",
  annotation: {
    mode: "pen",
    color: "#ef4444",
    strokeWidth: 4,
    lineStyle: "solid",
    blurEffect: "blur",
    blurAmount: 14,
  },
  annotations: [],
  annotationShapes: [],
}

const HISTORY_LIMIT = 100
const GROUP_MERGE_MS = 600

type SetPatch =
  | Partial<EditorState>
  | ((state: EditorState) => Partial<EditorState>)

type EditorActions = {
  setActiveTool: (t: EditorTool) => void
  setScreenshot: (s: string | null) => void
  applyCroppedScreenshot: (s: string, region: CropRegion) => void
  setAspect: (a: AspectState) => void
  setBackground: (b: Background) => void
  setPadding: (n: number) => void
  setBorderRadius: (n: number) => void
  setCanvasBorderRadius: (n: number) => void
  setBorder: (b: Border) => void
  setBackdropEffects: (e: BackdropEffects) => void
  setBackdropPattern: (p: BackdropPattern) => void
  setBackdropFilter: (f: AssetFilter) => void
  setTilt: (t: Tilt) => void
  setScale: (n: number) => void
  setCanvasZoom: (n: number) => void
  setScreenshotPosition: (p: ScreenshotPosition) => void
  setScreenshotOffset: (o: { x: number; y: number }) => void
  updateScreenshotLayer: (patch: Partial<ScreenshotLayer>) => void
  setShadow: (s: Shadow) => void
  setOverlay: (o: Overlay) => void
  setFrame: (f: DeviceFrame) => void
  setPortrait: (p: Portrait) => void
  setEnhance: (e: EnhancePreset) => void
  setAnnotation: (patch: Partial<Annotation>) => void
  addAnnotationStroke: (stroke: Omit<AnnotationStroke, "id">) => string
  updateAnnotationStroke: (id: string, points: AnnotationPoint[]) => void
  addAnnotationShape: (shape: Omit<AnnotationShape, "id" | "zIndex">) => string
  updateAnnotationShape: (id: string, patch: Partial<AnnotationShape>) => void
  deleteAnnotationShape: (id: string) => void
  duplicateAnnotationShape: (id: string) => string | null
  bringAnnotationShapeToFront: (id: string) => void
  sendAnnotationShapeToBack: (id: string) => void
  clearAnnotations: () => void
  addText: () => string
  updateText: (id: string, patch: Partial<TextElement>) => void
  deleteText: (id: string) => void
  duplicateText: (id: string) => string | null
  bringTextToFront: (id: string) => void
  sendTextToBack: (id: string) => void
  setSelectedTextId: (id: string | null) => void
  addAsset: (src: string) => string
  updateAsset: (id: string, patch: Partial<AssetElement>) => void
  deleteAsset: (id: string) => void
  duplicateAsset: (id: string) => string | null
  bringAssetToFront: (id: string) => void
  sendAssetToBack: (id: string) => void
  setSelectedAssetId: (id: string | null) => void
  setSelectedAnnotationShapeId: (id: string | null) => void
  setIsPreviewMode: (p: boolean) => void
  reset: () => void
  undo: () => void
  redo: () => void
}

type EditorStore = {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  _lastGroup: string | null
  _lastTs: number
  isPreviewMode: boolean
  selectedTextId: string | null
  selectedAssetId: string | null
  selectedAnnotationShapeId: string | null
} & EditorActions

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const computeNextZ = (items: { zIndex: number }[]) => {
  const max = items.length ? Math.max(...items.map((t) => t.zIndex)) : 0
  return Math.max(max + 1, 1)
}

const getLayerItems = (s: EditorState) => [
  s.screenshotLayer,
  ...s.assets,
  ...s.texts,
  ...s.annotationShapes,
]

const computeNextLayerZ = (s: EditorState) => computeNextZ(getLayerItems(s))

const getLayerRefs = (s: EditorState) => [
  { key: "screenshot", zIndex: s.screenshotLayer.zIndex },
  ...s.assets.map((asset) => ({
    key: `asset:${asset.id}`,
    zIndex: asset.zIndex,
  })),
  ...s.texts.map((text) => ({
    key: `text:${text.id}`,
    zIndex: text.zIndex,
  })),
  ...s.annotationShapes.map((shape) => ({
    key: `annotation:${shape.id}`,
    zIndex: shape.zIndex,
  })),
]

function applyLayerOrder(
  s: EditorState,
  refsBottomFirst: { key: string; zIndex: number }[]
): Partial<EditorState> {
  const zByKey = new Map(
    refsBottomFirst.map((layer, index) => [layer.key, index + 1])
  )
  return {
    screenshotLayer: {
      ...s.screenshotLayer,
      zIndex: zByKey.get("screenshot") ?? s.screenshotLayer.zIndex,
    },
    assets: s.assets.map((asset) => ({
      ...asset,
      zIndex: zByKey.get(`asset:${asset.id}`) ?? asset.zIndex,
    })),
    texts: s.texts.map((text) => ({
      ...text,
      zIndex: zByKey.get(`text:${text.id}`) ?? text.zIndex,
    })),
    annotationShapes: s.annotationShapes.map((shape) => ({
      ...shape,
      zIndex: zByKey.get(`annotation:${shape.id}`) ?? shape.zIndex,
    })),
  }
}

function moveLayerInStack(
  s: EditorState,
  key: string,
  position: "front" | "back"
): Partial<EditorState> {
  const refs = getLayerRefs(s).sort((a, b) => a.zIndex - b.zIndex)
  const index = refs.findIndex((layer) => layer.key === key)
  if (index < 0) return {}
  const [target] = refs.splice(index, 1)
  if (position === "front") refs.push(target)
  else refs.unshift(target)
  return applyLayerOrder(s, refs)
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

  return {
    past: [],
    present: DEFAULT_STATE,
    future: [],
    _lastGroup: null,
    _lastTs: 0,
    isPreviewMode: false,
    selectedTextId: null,
    selectedAssetId: null,
    selectedAnnotationShapeId: null,

    setActiveTool: (t) => commit({ activeTool: t }, null),
    setScreenshot: (screenshot) =>
      commit(
        (s) => ({
          screenshot,
          originalScreenshot: screenshot,
          lastCropRegion: null,
          screenshotPosition: "center",
          screenshotOffset: { x: 0, y: 0 },
          screenshotLayer: {
            ...s.screenshotLayer,
            zIndex:
              screenshot && !s.screenshot
                ? computeNextLayerZ(s)
                : s.screenshotLayer.zIndex,
            hidden: false,
          },
        }),
        null
      ),
    applyCroppedScreenshot: (s, region) =>
      commit({ screenshot: s, lastCropRegion: region }, "applyCroppedScreenshot"),
    setAspect: (a) => commit({ aspect: a }, "aspect"),
    setBackground: (b) => commit({ background: b }, "background"),
    setPadding: (n) => commit({ padding: n }, "padding"),
    setBorderRadius: (n) => commit({ borderRadius: n }, "borderRadius"),
    setCanvasBorderRadius: (n) =>
      commit({ canvasBorderRadius: n }, "canvasBorderRadius"),
    setBorder: (b) => commit({ border: b }, "border"),
    setBackdropEffects: (e) =>
      commit(
        (s) => ({ backdrop: { ...s.backdrop, effects: e } }),
        "backdrop-effects"
      ),
    setBackdropPattern: (p) =>
      commit(
        (s) => ({ backdrop: { ...s.backdrop, pattern: p } }),
        "backdrop-pattern"
      ),
    setBackdropFilter: (f) =>
      commit(
        (s) => ({ backdrop: { ...s.backdrop, filter: f } }),
        "backdrop-filter"
      ),
    setTilt: (t) => commit({ tilt: t }, "tilt"),
    setScale: (n) => commit({ scale: n }, "scale"),
    setCanvasZoom: (n) => commit({ canvasZoom: n }, "canvasZoom"),
    setScreenshotPosition: (p) =>
      commit(
        { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
        "screenshotPosition"
      ),
    setScreenshotOffset: (o) =>
      commit({ screenshotOffset: o }, "screenshotOffset"),
    updateScreenshotLayer: (patch) =>
      commit(
        (s) => ({ screenshotLayer: { ...s.screenshotLayer, ...patch } }),
        "screenshotLayer"
      ),
    setShadow: (s) => commit({ shadow: s }, "shadow"),
    setOverlay: (o) => commit({ overlay: o }, "overlay"),
    setFrame: (f) => commit({ frame: f }, "frame"),
    setPortrait: (p) => commit({ portrait: p }, "portrait"),
    setEnhance: (e) => commit({ enhance: e }, "enhance"),
    setAnnotation: (patch) =>
      commit((s) => ({ annotation: { ...s.annotation, ...patch } }), "annotation"),

    addAnnotationStroke: (stroke) => {
      const id = makeId()
      commit(
        (s) => ({ annotations: [...s.annotations, { ...stroke, id }] }),
        `annotation-stroke-${id}`
      )
      return id
    },
    updateAnnotationStroke: (id, points) =>
      commit(
        (s) => ({
          annotations: s.annotations.map((stroke) =>
            stroke.id === id ? { ...stroke, points } : stroke
          ),
        }),
        `annotation-stroke-${id}`
      ),

    addAnnotationShape: (shape) => {
      const id = makeId()
      commit(
        (s) => ({
          annotationShapes: [
            ...s.annotationShapes,
            { ...shape, id, zIndex: computeNextLayerZ(s) },
          ],
        }),
        null
      )
      return id
    },
    updateAnnotationShape: (id, patch) =>
      commit(
        (s) => ({
          annotationShapes: s.annotationShapes.map((shape) =>
            shape.id === id ? { ...shape, ...patch } : shape
          ),
        }),
        `annotation-shape-${id}`
      ),
    deleteAnnotationShape: (id) =>
      commit(
        (s) => ({
          annotationShapes: s.annotationShapes.filter(
            (shape) => shape.id !== id
          ),
        }),
        null
      ),
    duplicateAnnotationShape: (id) => {
      const copyId = makeId()
      let didCopy = false
      commit((s) => {
        const src = s.annotationShapes.find((shape) => shape.id === id)
        if (!src) return { annotationShapes: s.annotationShapes }
        didCopy = true
        const copy: AnnotationShape = {
          ...src,
          id: copyId,
          xPct: Math.min(98, src.xPct + 3),
          yPct: Math.min(98, src.yPct + 3),
          zIndex: computeNextLayerZ(s),
        }
        return { annotationShapes: [...s.annotationShapes, copy] }
      }, null)
      return didCopy ? copyId : null
    },
    bringAnnotationShapeToFront: (id) =>
      commit((s) => moveLayerInStack(s, `annotation:${id}`, "front"), null),
    sendAnnotationShapeToBack: (id) =>
      commit((s) => moveLayerInStack(s, `annotation:${id}`, "back"), null),
    clearAnnotations: () =>
      commit({ annotations: [], annotationShapes: [] }, null),

    addText: () => {
      const id = makeId()
      commit(
        (s) => ({
          texts: [
            ...s.texts,
            {
              id,
              content: "Double-click to edit",
              xPct: 50,
              yPct: 85,
              rotation: 0,
              fontSize: 18,
              fontFamily: FONT_FAMILIES[0].css,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: 0,
              color: "#ffffff",
              align: "left",
              borderColor: null,
              borderWidth: 1,
              borderStyle: "solid",
              zIndex: computeNextLayerZ(s),
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
    updateText: (id, patch) =>
      commit(
        (s) => ({
          texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }),
        `text-${id}`
      ),
    deleteText: (id) =>
      commit((s) => ({ texts: s.texts.filter((t) => t.id !== id) }), null),
    duplicateText: (id) => {
      const copyId = makeId()
      commit((s) => {
        const src = s.texts.find((t) => t.id === id)
        if (!src) return { texts: s.texts }
        const copy: TextElement = {
          ...src,
          id: copyId,
          xPct: Math.min(95, src.xPct + 4),
          yPct: Math.min(95, src.yPct + 4),
          zIndex: computeNextLayerZ(s),
        }
        return { texts: [...s.texts, copy] }
      }, null)
      return copyId
    },
    bringTextToFront: (id) =>
      commit((s) => moveLayerInStack(s, `text:${id}`, "front"), null),
    sendTextToBack: (id) =>
      commit((s) => moveLayerInStack(s, `text:${id}`, "back"), null),
    setSelectedTextId: (id) => set({ selectedTextId: id }),

    addAsset: (src) => {
      const id = makeId()
      commit(
        (s) => ({
          assets: [
            ...s.assets,
            {
              id,
              src,
              xPct: 50,
              yPct: 50,
              widthPct: 25,
              heightPct: null,
              rotation: 0,
              zIndex: computeNextLayerZ(s),
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
    updateAsset: (id, patch) =>
      commit(
        (s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }),
        `asset-${id}`
      ),
    deleteAsset: (id) =>
      commit((s) => ({ assets: s.assets.filter((a) => a.id !== id) }), null),
    duplicateAsset: (id) => {
      const copyId = makeId()
      let didCopy = false
      commit((s) => {
        const src = s.assets.find((a) => a.id === id)
        if (!src) return { assets: s.assets }
        didCopy = true
        const copy: AssetElement = {
          ...src,
          id: copyId,
          xPct: Math.min(95, src.xPct + 4),
          yPct: Math.min(95, src.yPct + 4),
          zIndex: computeNextLayerZ(s),
        }
        return { assets: [...s.assets, copy] }
      }, null)
      return didCopy ? copyId : null
    },
    bringAssetToFront: (id) =>
      commit((s) => moveLayerInStack(s, `asset:${id}`, "front"), null),
    sendAssetToBack: (id) =>
      commit((s) => moveLayerInStack(s, `asset:${id}`, "back"), null),
    setSelectedAssetId: (id) => set({ selectedAssetId: id }),
    setSelectedAnnotationShapeId: (id) => set({ selectedAnnotationShapeId: id }),
    setIsPreviewMode: (p) => set({ isPreviewMode: p }),

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
      })
    },
  }
})

export type EditorContext = EditorState &
  EditorActions & {
    isPreviewMode: boolean
    selectedTextId: string | null
    selectedAssetId: string | null
    selectedAnnotationShapeId: string | null
    canUndo: boolean
    canRedo: boolean
  }

export function useEditor(): EditorContext {
  const store = useEditorStore()
  return {
    ...store.present,
    isPreviewMode: store.isPreviewMode,
    selectedTextId: store.selectedTextId,
    selectedAssetId: store.selectedAssetId,
    selectedAnnotationShapeId: store.selectedAnnotationShapeId,
    canUndo: store.past.length > 0,
    canRedo: store.future.length > 0,
    setActiveTool: store.setActiveTool,
    setScreenshot: store.setScreenshot,
    applyCroppedScreenshot: store.applyCroppedScreenshot,
    setAspect: store.setAspect,
    setBackground: store.setBackground,
    setPadding: store.setPadding,
    setBorderRadius: store.setBorderRadius,
    setCanvasBorderRadius: store.setCanvasBorderRadius,
    setBorder: store.setBorder,
    setBackdropEffects: store.setBackdropEffects,
    setBackdropPattern: store.setBackdropPattern,
    setBackdropFilter: store.setBackdropFilter,
    setTilt: store.setTilt,
    setScale: store.setScale,
    setCanvasZoom: store.setCanvasZoom,
    setScreenshotPosition: store.setScreenshotPosition,
    setScreenshotOffset: store.setScreenshotOffset,
    updateScreenshotLayer: store.updateScreenshotLayer,
    setShadow: store.setShadow,
    setOverlay: store.setOverlay,
    setFrame: store.setFrame,
    setPortrait: store.setPortrait,
    setEnhance: store.setEnhance,
    setAnnotation: store.setAnnotation,
    addAnnotationStroke: store.addAnnotationStroke,
    updateAnnotationStroke: store.updateAnnotationStroke,
    addAnnotationShape: store.addAnnotationShape,
    updateAnnotationShape: store.updateAnnotationShape,
    deleteAnnotationShape: store.deleteAnnotationShape,
    duplicateAnnotationShape: store.duplicateAnnotationShape,
    bringAnnotationShapeToFront: store.bringAnnotationShapeToFront,
    sendAnnotationShapeToBack: store.sendAnnotationShapeToBack,
    clearAnnotations: store.clearAnnotations,
    addText: store.addText,
    updateText: store.updateText,
    deleteText: store.deleteText,
    duplicateText: store.duplicateText,
    bringTextToFront: store.bringTextToFront,
    sendTextToBack: store.sendTextToBack,
    setSelectedTextId: store.setSelectedTextId,
    addAsset: store.addAsset,
    updateAsset: store.updateAsset,
    deleteAsset: store.deleteAsset,
    duplicateAsset: store.duplicateAsset,
    bringAssetToFront: store.bringAssetToFront,
    sendAssetToBack: store.sendAssetToBack,
    setSelectedAssetId: store.setSelectedAssetId,
    setSelectedAnnotationShapeId: store.setSelectedAnnotationShapeId,
    setIsPreviewMode: store.setIsPreviewMode,
    reset: store.reset,
    undo: store.undo,
    redo: store.redo,
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
