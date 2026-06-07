"use client"

import { create } from "zustand"

import {
  LAYOUT_PRESETS,
  PRESENT_PRESETS,
  resolvePresentPresetScale,
} from "./present-presets"
import type { TweetCardSettings } from "./tweet-settings"
import {
  resolveActivePresetGeometry,
  resolveMainOffsetPx,
  resolveSlotPositionPct,
} from "./preset-geometry"
import { computeRowLayout } from "./screenshot-layout"
import { computeNextLayerZ, moveLayerInStack } from "./store/layer-stack"
import {
  applySharedFrameToCanvas,
  aspectRatioFromState,
  CANVAS_BASE_W,
  clampPct,
  cloneBorder,
  cloneLighting,
  cloneShadow,
  createScreenshotSlot,
  duplicateLayerItem,
  layoutSlotsInRow,
  makeId,
  mirrorToSlots,
  placeNewSlotInRow,
  placementAfterCanvas,
  removeSlotFromRow,
  resolveActiveLayoutGeometry,
  scaleAnnotationStrokesForAspectChange,
  scaleScreenshotOffsetForAspectChange,
  stateCanvasAspect,
  type PresetTab,
} from "./store/canvas-helpers"
import {
  CLEAR_SELECTION,
  createCanvas,
  DEFAULT_STATE,
  GROUP_MERGE_MS,
  HISTORY_LIMIT,
  MAX_CANVASES,
  MAX_SCREENSHOT_SLOTS,
} from "./store/defaults"
import {
  normalizeEditorState,
  type CurrentDraftInfo,
} from "./store/draft-persistence"
import { FONT_FAMILIES } from "./fonts"
import type {
  Annotation,
  AnnotationPoint,
  AnnotationShape,
  AnnotationStroke,
  AspectState,
  AssetElement,
  AssetFilter,
  Background,
  Backdrop,
  BackdropEffects,
  BackdropLighting,
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
  TweetCard,
} from "./state-types"

const TWEET_POST_ASPECT: AspectState = { id: "x-post", w: 1080, h: 1080 }

export * from "./state-types"
export {
  ANNOTATION_COLORS,
  ANNOTATION_STROKES,
  AUTO_PLACEHOLDER_GRADIENT,
  BACKDROP_PATTERNS,
  BACKGROUND_LIBRARY,
  DEFAULT_IMAGE_BACKGROUND,
  DEFAULT_IMAGE_BACKGROUND_ENTRY,
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

export { MAX_CANVASES, MAX_SCREENSHOT_SLOTS }
export type { PresetTab, CurrentDraftInfo }

export {
  CanvasPreviewScope,
  CanvasScope,
  useActiveCanvasField,
  useActiveCanvasId,
  useCanvasById,
  useCanvases,
  useCanvasPreviewMode,
  useCanvasScopeId,
  useEditor,
  useSelectedScreenshotSlot,
  type EditorContext,
} from "./store/use-editor"
export { EditorProvider, saveCurrentEditorDraft } from "./store/provider"

type SetPatch =
  | Partial<EditorState>
  | ((state: EditorState) => Partial<EditorState>)

type CanvasPatch =
  | Partial<CanvasState>
  | ((canvas: CanvasState, state: EditorState) => Partial<CanvasState>)

export type CustomPresetSlotConfig = {
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
 * Full visual snapshot of a canvas that gets re-applied when a custom preset
 * is selected. We capture every styling field — background, backdrop, border,
 * shadow, overlay, frame, portrait, enhance, padding/radius, layers, etc. —
 * but never the actual screenshot pixels. Slots carry geometry + filters but
 * never their image source either.
 */
export type CustomPresetCanvasStyle = {
  background: Background
  padding: number
  borderRadius: number
  canvasBorderRadius: number
  border: Border
  backdrop: Backdrop
  screenshotPosition: ScreenshotPosition
  screenshotLayer: ScreenshotLayer
  shadow: Shadow
  overlay: Overlay
  frame: DeviceFrame
  portrait: Portrait
  enhance: EnhancePreset
  objectFit?: "contain" | "cover" | "fill"
  frameAddress: string
  texts: TextElement[]
  assets: AssetElement[]
  annotations: AnnotationStroke[]
  annotationShapes: AnnotationShape[]
  aspect?: AspectState
  tweetSettings?: TweetCardSettings
}

export type CustomPresetGeometry = {
  canvasTilt: Tilt
  canvasScale: number
  slots: CustomPresetSlotConfig[]
  mainOffset?: { xPct: number; yPct: number }
  relativeSlotPositions?: boolean
  canvasStyle?: CustomPresetCanvasStyle
}

export type CustomPresetSummary = {
  id: string
  name: string
  slotCount: number
  geometry: CustomPresetGeometry
}

export type DraftLoadUi = {
  presetTab?: PresetTab
  activeLayoutPresetId?: string | null
  activeCustomPresetId?: string | null
  activeSinglePresetId?: string | null
  bulkEditMode?: boolean
  bulkViewportZoom?: number
  bulkScale?: number
  previewAutoScrollDelay?: number
  previewAnimation?: "slide" | "fade" | "zoom" | "flip"
}

export type EditorActions = {
  setTopBarPopoverOpen: (open: boolean) => void
  setActiveTool: (t: EditorTool) => void
  setPresetTab: (tab: PresetTab) => void
  setActiveLayoutPresetId: (id: string | null) => void
  setActiveCustomPresetId: (id: string | null) => void
  setActiveSinglePresetId: (id: string | null) => void
  setCustomPresets: (presets: CustomPresetSummary[]) => void
  addCustomPreset: (preset: CustomPresetSummary) => void
  updateCustomPreset: (id: string, patch: Partial<CustomPresetSummary>) => void
  removeCustomPreset: (id: string) => void
  setCurrentDraft: (draft: CurrentDraftInfo | null) => void
  loadDraftState: (
    state: Partial<EditorState>,
    draft: CurrentDraftInfo,
    ui?: DraftLoadUi
  ) => void
  applyPresetSnapshot: (
    snapshot: CustomPresetGeometry,
    canvasId?: string
  ) => void
  setScreenshot: (s: string | null, canvasId?: string) => void
  applyCroppedScreenshot: (
    s: string,
    region: CropRegion,
    canvasId?: string
  ) => void
  setAspect: (a: AspectState) => void
  setCanvasAspect: (canvasId: string, a: AspectState) => void
  setBackground: (b: Background, canvasId?: string) => void
  setPadding: (n: number, canvasId?: string) => void
  setBorderRadius: (n: number, canvasId?: string) => void
  setCanvasBorderRadius: (n: number, canvasId?: string) => void
  setBorder: (b: Border, canvasId?: string) => void
  setMainScreenshotPadding: (n: number, canvasId?: string) => void
  setMainScreenshotBorderRadius: (n: number, canvasId?: string) => void
  setMainScreenshotBorder: (b: Border, canvasId?: string) => void
  setBackdropEffects: (e: BackdropEffects, canvasId?: string) => void
  setBackdropPattern: (p: BackdropPattern, canvasId?: string) => void
  setBackdropLighting: (l: BackdropLighting, canvasId?: string) => void
  setMainScreenshotBackdropLighting: (
    l: BackdropLighting,
    canvasId?: string
  ) => void
  setBackdropFilter: (f: AssetFilter, canvasId?: string) => void
  setTilt: (t: Tilt, canvasId?: string) => void
  setScale: (n: number, canvasId?: string) => void
  setTiltAndScale: (t: Tilt, scale: number, canvasId?: string) => void
  setScreenshotTilt: (t: Tilt, canvasId?: string) => void
  setScreenshotScale: (n: number, canvasId?: string) => void
  setScreenshotRotation: (n: number, canvasId?: string) => void
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
  setMainScreenshotShadow: (s: Shadow, canvasId?: string) => void
  setOverlay: (o: Overlay, canvasId?: string) => void
  setFrame: (f: DeviceFrame, canvasId?: string) => void
  setFrameForMatchingScreenshots: (f: DeviceFrame, canvasId?: string) => void
  setFrameAddress: (address: string, canvasId?: string) => void
  setTweet: (card: TweetCard, canvasId?: string) => void
  updateTweet: (patch: Partial<TweetCard>, canvasId?: string) => void
  clearTweet: (canvasId?: string) => void
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
  applyCroppedScreenshotSlot: (
    id: string,
    src: string,
    region: CropRegion,
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

export type EditorStore = {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
  _lastGroup: string | null
  _lastTs: number
  topBarPopoverOpen: boolean
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
  presetTab: PresetTab
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  activeSinglePresetId: string | null
  customPresets: CustomPresetSummary[]
  customPresetsLoaded: boolean
  currentDraft: CurrentDraftInfo | null
} & EditorActions

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

  const makeLayerOps = (
    prefix: string,
    getGroup?: (id: string) => string | null
  ) => ({
    toFront: (id: string, canvasId?: string) =>
      commitCanvas(
        canvasId,
        (c) => moveLayerInStack(c, `${prefix}:${id}`, "front"),
        getGroup?.(id) ?? null
      ),
    toBack: (id: string, canvasId?: string) =>
      commitCanvas(
        canvasId,
        (c) => moveLayerInStack(c, `${prefix}:${id}`, "back"),
        getGroup?.(id) ?? null
      ),
  })

  const textLayerOps = makeLayerOps("text")
  const assetLayerOps = makeLayerOps("asset")
  const annotationShapeLayerOps = makeLayerOps("annotation")
  const slotLayerOps = makeLayerOps("slot", (id) => `slot-layer-${id}`)

  return {
    past: [],
    present: DEFAULT_STATE,
    future: [],
    _lastGroup: null,
    _lastTs: 0,
    topBarPopoverOpen: false,
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
    presetTab: "single",
    activeLayoutPresetId: null,
    activeCustomPresetId: null,
    activeSinglePresetId: null,
    customPresets: [],
    customPresetsLoaded: false,
    currentDraft: null,

    setActiveTool: (t) => commit({ activeTool: t }, null),
    setPresetTab: (tab) => set({ presetTab: tab }),
    setActiveLayoutPresetId: (id) => set({ activeLayoutPresetId: id }),
    setActiveCustomPresetId: (id) => set({ activeCustomPresetId: id }),
    setActiveSinglePresetId: (id) => set({ activeSinglePresetId: id }),
    setCustomPresets: (presets) =>
      set({ customPresets: presets, customPresetsLoaded: true }),
    addCustomPreset: (preset) =>
      set((state) => ({
        customPresets: [preset, ...state.customPresets],
        customPresetsLoaded: true,
      })),
    updateCustomPreset: (id, patch) =>
      set((state) => ({
        customPresets: state.customPresets.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      })),
    removeCustomPreset: (id) =>
      set((state) => ({
        customPresets: state.customPresets.filter((p) => p.id !== id),
        activeCustomPresetId:
          state.activeCustomPresetId === id ? null : state.activeCustomPresetId,
      })),
    setCurrentDraft: (draft) => set({ currentDraft: draft }),
    loadDraftState: (state, draft, ui) => {
      const present = normalizeEditorState(state)
      const defaultBulk = present.canvases.length > 1
      set({
        past: [],
        present,
        future: [],
        _lastGroup: null,
        _lastTs: 0,
        currentDraft: draft,
        // UI state — fall back to defaults when the saved draft predates the
        // wrapped payload shape.
        presetTab: ui?.presetTab ?? "single",
        activeLayoutPresetId: ui?.activeLayoutPresetId ?? null,
        activeCustomPresetId: ui?.activeCustomPresetId ?? null,
        activeSinglePresetId: ui?.activeSinglePresetId ?? null,
        bulkEditMode: ui?.bulkEditMode ?? defaultBulk,
        bulkViewportZoom: ui?.bulkViewportZoom ?? 1,
        bulkScale: ui?.bulkScale ?? 65,
        previewAutoScrollDelay: ui?.previewAutoScrollDelay ?? 3000,
        previewAnimation: ui?.previewAnimation ?? "slide",
        ...CLEAR_SELECTION,
      })
    },
    applyPresetSnapshot: (snapshot, canvasId) => {
      commit((state) => {
        const targetId = canvasId ?? state.activeCanvasId
        const canvases = state.canvases.map((canvas) => {
          if (canvas.id !== targetId) return canvas

          const existingSlots = canvas.screenshotSlots
          const slots: ScreenshotSlot[] = canvas.tweet
            ? []
            : snapshot.slots.map((config, index) => {
                const previous = existingSlots[index]
                return {
                  id: previous?.id ?? makeId(),
                  src: previous?.src ?? null,
                  xPct: config.xPct,
                  yPct: config.yPct,
                  widthPct: config.widthPct ?? previous?.widthPct ?? 60,
                  heightPct: config.heightPct ?? previous?.heightPct ?? 28,
                  rotation: config.rotation,
                  tilt: config.tilt,
                  scale: config.scale,
                  zIndex:
                    config.zIndex ??
                    previous?.zIndex ??
                    computeNextLayerZ(canvas) + index,
                  filter: config.filter ?? previous?.filter ?? "none",
                  hidden: config.hidden ?? previous?.hidden,
                  objectFit: config.objectFit ?? previous?.objectFit,
                  shadow: config.shadow ?? previous?.shadow,
                }
              })

          const offset = resolveMainOffsetPx(snapshot.mainOffset)

          const style = snapshot.canvasStyle
          const next: CanvasState = {
            ...canvas,
            // styling — only override fields the snapshot actually carries
            ...(style?.background ? { background: style.background } : {}),
            ...(style && typeof style.padding === "number"
              ? { padding: style.padding }
              : {}),
            ...(style && typeof style.borderRadius === "number"
              ? { borderRadius: style.borderRadius }
              : {}),
            ...(style && typeof style.canvasBorderRadius === "number"
              ? { canvasBorderRadius: style.canvasBorderRadius }
              : {}),
            ...(style?.border ? { border: style.border } : {}),
            ...(style?.backdrop ? { backdrop: style.backdrop } : {}),
            ...(style?.screenshotLayer
              ? { screenshotLayer: style.screenshotLayer }
              : {}),
            ...(style?.shadow ? { shadow: style.shadow } : {}),
            ...(style?.overlay ? { overlay: style.overlay } : {}),
            ...(style?.frame && !canvas.tweet ? { frame: style.frame } : {}),
            ...(style?.portrait ? { portrait: style.portrait } : {}),
            ...(style?.enhance ? { enhance: style.enhance } : {}),
            ...(style?.objectFit ? { objectFit: style.objectFit } : {}),
            ...(typeof style?.frameAddress === "string"
              ? { frameAddress: style.frameAddress }
              : {}),
            ...(Array.isArray(style?.texts) ? { texts: style.texts } : {}),
            ...(Array.isArray(style?.assets) ? { assets: style.assets } : {}),
            ...(Array.isArray(style?.annotations)
              ? { annotations: style.annotations }
              : {}),
            ...(Array.isArray(style?.annotationShapes)
              ? { annotationShapes: style.annotationShapes }
              : {}),
            ...(style?.aspect ? { aspect: style.aspect } : {}),
            ...(style?.tweetSettings && canvas.tweet
              ? { tweet: { ...canvas.tweet, ...style.tweetSettings } }
              : {}),
            // geometry
            tilt: snapshot.canvasTilt,
            scale: snapshot.canvasScale,
            screenshotPosition: style?.screenshotPosition ?? "center",
            screenshotOffset: offset,
            screenshotSlots: canvas.tweet ? [] : slots,
            // always preserved from the live canvas
            screenshot: canvas.screenshot,
            originalScreenshot: canvas.originalScreenshot,
            lastCropRegion: canvas.lastCropRegion,
          }
          return next
        })
        return { canvases }
      }, "preset:apply")
    },
    setScreenshot: (screenshot, canvasId) => {
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshot,
          originalScreenshot: screenshot,
          lastCropRegion: null,
          // A screenshot replaces any tweet as the canvas's main content.
          tweet: screenshot ? null : canvas.tweet,
          objectFit: canvas.objectFit ?? "contain",
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
      const snapshot = get()
      commit((state) => {
        const currentAspect = stateCanvasAspect(state)
        const nextAspect = aspectRatioFromState(a)

        return {
          aspect: a,
          canvases: state.canvases.map((canvas) => {
            // Resolve the active preset (built-in *or* user-saved custom)
            // for *this* canvas's frame, so portrait-device variants kick
            // in correctly for layout presets.
            const activeGeometry = resolveActivePresetGeometry({
              activeLayoutPresetId: snapshot.activeLayoutPresetId,
              activeCustomPresetId: snapshot.activeCustomPresetId,
              layoutPresets: LAYOUT_PRESETS,
              customPresets: snapshot.customPresets,
              frame: canvas.frame,
            })
            const shouldReapply =
              activeGeometry !== null &&
              canvas.id === state.activeCanvasId &&
              canvas.screenshotSlots.length === activeGeometry.slots.length
            const activeSinglePreset =
              !activeGeometry && canvas.id === state.activeCanvasId
                ? PRESENT_PRESETS.find(
                    (preset) => preset.id === snapshot.activeSinglePresetId
                  )
                : undefined

            let screenshotSlots = layoutSlotsInRow(
              canvas.screenshotSlots,
              canvas.frame,
              nextAspect
            )
            if (shouldReapply && activeGeometry) {
              screenshotSlots = screenshotSlots.map((naturalSlot, index) => {
                const config = activeGeometry.slots[index]
                if (!config) return naturalSlot
                const { xPct, yPct } = resolveSlotPositionPct({
                  config,
                  naturalSlotXPct: naturalSlot.xPct,
                  relativeSlotPositions: activeGeometry.relativeSlotPositions,
                })
                return {
                  ...naturalSlot,
                  xPct,
                  yPct,
                  rotation: config.rotation,
                  tilt: config.tilt,
                  scale: config.scale,
                  ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
                }
              })
            } else if (activeSinglePreset) {
              const scale = resolvePresentPresetScale(
                activeSinglePreset,
                canvas.frame
              )
              screenshotSlots = screenshotSlots.map((slot) => ({
                ...slot,
                yPct: 50,
                rotation: 0,
                tilt: activeSinglePreset.tilt,
                scale,
              }))
            }

            const screenshotOffset =
              shouldReapply && activeGeometry
                ? resolveMainOffsetPx(activeGeometry.mainOffset)
                : scaleScreenshotOffsetForAspectChange(
                    canvas.screenshotOffset,
                    currentAspect,
                    nextAspect
                  )

            return {
              ...canvas,
              tilt:
                shouldReapply && activeGeometry
                  ? activeGeometry.canvasTilt
                  : activeSinglePreset
                    ? activeSinglePreset.tilt
                    : canvas.tilt,
              scale:
                shouldReapply && activeGeometry
                  ? activeGeometry.canvasScale
                  : activeSinglePreset
                    ? resolvePresentPresetScale(
                        activeSinglePreset,
                        canvas.frame
                      )
                    : canvas.scale,
              screenshotOffset,
              screenshotSlots,
              annotations: scaleAnnotationStrokesForAspectChange(
                canvas.annotations,
                currentAspect,
                nextAspect
              ),
            }
          }),
        }
      }, "aspect")
    },
    setCanvasAspect: (canvasId, a) => {
      const snapshot = get()
      commitCanvas(
        canvasId,
        (canvas, state) => {
          const currentAspect = aspectRatioFromState(
            canvas.aspect ?? state.aspect
          )
          const nextAspect = aspectRatioFromState(a)
          const activeGeometry = resolveActivePresetGeometry({
            activeLayoutPresetId: snapshot.activeLayoutPresetId,
            activeCustomPresetId: snapshot.activeCustomPresetId,
            layoutPresets: LAYOUT_PRESETS,
            customPresets: snapshot.customPresets,
            frame: canvas.frame,
          })
          const shouldReapply =
            activeGeometry !== null &&
            canvas.screenshotSlots.length === activeGeometry.slots.length
          const activeSinglePreset = !activeGeometry
            ? PRESENT_PRESETS.find(
                (preset) => preset.id === snapshot.activeSinglePresetId
              )
            : undefined

          let screenshotSlots = layoutSlotsInRow(
            canvas.screenshotSlots,
            canvas.frame,
            nextAspect
          )
          if (shouldReapply && activeGeometry) {
            screenshotSlots = screenshotSlots.map((naturalSlot, index) => {
              const config = activeGeometry.slots[index]
              if (!config) return naturalSlot
              const { xPct, yPct } = resolveSlotPositionPct({
                config,
                naturalSlotXPct: naturalSlot.xPct,
                relativeSlotPositions: activeGeometry.relativeSlotPositions,
              })
              return {
                ...naturalSlot,
                xPct,
                yPct,
                rotation: config.rotation,
                tilt: config.tilt,
                scale: config.scale,
                ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
              }
            })
          } else if (activeSinglePreset) {
            const scale = resolvePresentPresetScale(
              activeSinglePreset,
              canvas.frame
            )
            screenshotSlots = screenshotSlots.map((slot) => ({
              ...slot,
              yPct: 50,
              rotation: 0,
              tilt: activeSinglePreset.tilt,
              scale,
            }))
          }

          return {
            aspect: a,
            tilt:
              shouldReapply && activeGeometry
                ? activeGeometry.canvasTilt
                : activeSinglePreset
                  ? activeSinglePreset.tilt
                  : canvas.tilt,
            scale:
              shouldReapply && activeGeometry
                ? activeGeometry.canvasScale
                : activeSinglePreset
                  ? resolvePresentPresetScale(activeSinglePreset, canvas.frame)
                  : canvas.scale,
            screenshotOffset:
              shouldReapply && activeGeometry
                ? resolveMainOffsetPx(activeGeometry.mainOffset)
                : scaleScreenshotOffsetForAspectChange(
                    canvas.screenshotOffset,
                    currentAspect,
                    nextAspect
                  ),
            screenshotSlots,
            annotations: scaleAnnotationStrokesForAspectChange(
              canvas.annotations,
              currentAspect,
              nextAspect
            ),
          }
        },
        "aspect"
      )
    },
    setBackground: (b, canvasId) =>
      commitCanvas(canvasId, { background: b }, "background"),
    setPadding: (n, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          padding: n,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, {
            padding: n,
          }),
        }),
        "padding"
      ),
    setBorderRadius: (n, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          borderRadius: n,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, {
            borderRadius: n,
          }),
        }),
        "borderRadius"
      ),
    setCanvasBorderRadius: (n, canvasId) =>
      commitCanvas(canvasId, { canvasBorderRadius: n }, "canvasBorderRadius"),
    setBorder: (b, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          border: b,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            border: cloneBorder(b),
          })),
        }),
        "border"
      ),
    setMainScreenshotPadding: (n, canvasId) =>
      commitCanvas(canvasId, { padding: n }, "padding"),
    setMainScreenshotBorderRadius: (n, canvasId) =>
      commitCanvas(canvasId, { borderRadius: n }, "borderRadius"),
    setMainScreenshotBorder: (b, canvasId) =>
      commitCanvas(canvasId, { border: b }, "border"),
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
    setBackdropLighting: (l, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          backdrop: { ...canvas.backdrop, lighting: l },
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            lighting: cloneLighting(l),
          })),
        }),
        "backdrop-lighting"
      ),
    setMainScreenshotBackdropLighting: (l, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, lighting: l } }),
        "backdrop-lighting"
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
    setScreenshotTilt: (t, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          tilt: t,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            tilt: { ...t },
          })),
        }),
        "tilt"
      ),
    setScreenshotScale: (n, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          scale: n,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, { scale: n }),
        }),
        "scale"
      ),
    setScreenshotRotation: (n, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          tilt: { ...canvas.tilt, rz: n },
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, {
            rotation: n,
          }),
        }),
        "tilt"
      ),
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
    setShadow: (s, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          shadow: s,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            shadow: cloneShadow(s),
          })),
        }),
        "shadow"
      ),
    setMainScreenshotShadow: (s, canvasId) =>
      commitCanvas(canvasId, { shadow: s }, "shadow"),
    setOverlay: (o, canvasId) =>
      commitCanvas(canvasId, { overlay: o }, "overlay"),
    setFrame: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => {
          if (canvas.tweet) {
            return {
              frame: { id: "none", color: "black", orientation: "vertical" },
              frameAddress: "",
            }
          }
          return applySharedFrameToCanvas(
            canvas,
            state,
            f,
            get().activeLayoutPresetId
          )
        },
        "frame"
      ),
    setFrameForMatchingScreenshots: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => {
          if (canvas.tweet) {
            return {
              frame: { id: "none", color: "black", orientation: "vertical" },
              frameAddress: "",
            }
          }
          return applySharedFrameToCanvas(
            canvas,
            state,
            f,
            get().activeLayoutPresetId
          )
        },
        "frame"
      ),
    setFrameAddress: (address, canvasId) =>
      commitCanvas(canvasId, { frameAddress: address }, "frame-address"),
    setTweet: (card, canvasId) => {
      commit((state) => {
        const targetId = canvasId ?? state.activeCanvasId
        return {
          aspect: { ...TWEET_POST_ASPECT },
          canvases: state.canvases.map((canvas) =>
            canvas.id === targetId
              ? {
                  ...canvas,
                  // A tweet replaces the screenshot as the canvas's main content.
                  tweet: card,
                  screenshot: null,
                  originalScreenshot: null,
                  lastCropRegion: null,
                  screenshotSlots: [],
                  frame: {
                    id: "none",
                    color: "black",
                    orientation: "vertical",
                  },
                  frameAddress: "",
                  screenshotPosition: "center",
                  screenshotOffset: { x: 0, y: 0 },
                  aspect: undefined,
                }
              : canvas
          ),
        }
      }, null)
      set({
        presetTab: "single",
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
      })
    },
    updateTweet: (patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) =>
          canvas.tweet ? { tweet: { ...canvas.tweet, ...patch } } : {},
        "tweet"
      ),
    clearTweet: (canvasId) => commitCanvas(canvasId, { tweet: null }, null),
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
          const result = duplicateLayerItem(
            canvas.annotationShapes,
            id,
            copyId,
            computeNextLayerZ(canvas),
            { offset: 3, maxPct: 98 }
          )
          didCopy = result.ok
          return { annotationShapes: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAnnotationShapeToFront: annotationShapeLayerOps.toFront,
    sendAnnotationShapeToBack: annotationShapeLayerOps.toBack,
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
          const result = duplicateLayerItem(
            canvas.texts,
            id,
            copyId,
            computeNextLayerZ(canvas)
          )
          didCopy = result.ok
          return { texts: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringTextToFront: textLayerOps.toFront,
    sendTextToBack: textLayerOps.toBack,
    setSelectedTextId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedTextId: id }
          : { selectedTextId: null }
      ),

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
          const result = duplicateLayerItem(
            canvas.assets,
            id,
            copyId,
            computeNextLayerZ(canvas)
          )
          didCopy = result.ok
          return { assets: result.items }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringAssetToFront: assetLayerOps.toFront,
    sendAssetToBack: assetLayerOps.toBack,
    setSelectedAssetId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedAssetId: id }
          : { selectedAssetId: null }
      ),
    setSelectedAnnotationShapeId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedAnnotationShapeId: id }
          : { selectedAnnotationShapeId: null }
      ),
    setSelectedScreenshotSlotId: (id) =>
      set(
        id
          ? { ...CLEAR_SELECTION, selectedScreenshotSlotId: id }
          : { selectedScreenshotSlotId: null }
      ),
    setIsScreenshotSelected: (selected) =>
      set(
        selected
          ? { ...CLEAR_SELECTION, isScreenshotSelected: true }
          : { isScreenshotSelected: false }
      ),
    setTopBarPopoverOpen: (open) => set({ topBarPopoverOpen: open }),
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
        currentDraft: null,
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
        activeSinglePresetId: null,
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
        ...CLEAR_SELECTION,
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
      set({ ...CLEAR_SELECTION })
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
      set({ ...CLEAR_SELECTION })
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
      if (
        !target ||
        target.tweet ||
        target.screenshotSlots.length >= MAX_SCREENSHOT_SLOTS
      ) {
        return null
      }
      const id = makeId()
      commitCanvas(
        targetId,
        (canvas, state) => {
          const next = createScreenshotSlot(
            {
              id,
              tilt: { ...canvas.tilt },
              scale: canvas.scale,
              border: cloneBorder(canvas.border),
              borderRadius: canvas.borderRadius,
              padding: canvas.padding,
              shadow: cloneShadow(canvas.shadow),
              lighting: cloneLighting(canvas.backdrop.lighting),
            },
            computeNextLayerZ(canvas)
          )
          return {
            screenshotSlots: placeNewSlotInRow(
              canvas.screenshotSlots,
              next,
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
        (canvas) => ({
          screenshotSlots: canvas.screenshotSlots.map((slot) =>
            slot.id === id ? { ...slot, ...patch } : slot
          ),
        }),
        `screenshot-slot-${id}`
      ),
    setScreenshotSlotImage: (id, src, canvasId) => {
      if (src === null) {
        commitCanvas(
          canvasId,
          (canvas) => ({
            screenshotSlots: canvas.screenshotSlots.map((slot) =>
              slot.id === id
                ? { ...slot, src, originalSrc: null, lastCropRegion: null }
                : slot
            ),
          }),
          null
        )
        return
      }

      const snapshot = get()
      commitCanvas(
        canvasId,
        (canvas, state) => {
          const activeLayoutGeometry = resolveActiveLayoutGeometry(
            snapshot,
            canvas.frame
          )
          const updatedSlots = canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  src,
                  originalSrc: src,
                  lastCropRegion: null,
                  objectFit: slot.objectFit ?? "contain",
                }
              : slot
          )
          if (
            !activeLayoutGeometry ||
            updatedSlots.length !== activeLayoutGeometry.slots.length
          ) {
            return { screenshotSlots: updatedSlots }
          }
          // When the active layout preset uses relative slot positions, the
          // preset's xPct/yPct are offsets from each slot's natural row-layout
          // position — not absolute values. Mirror the same resolution
          // applyLayoutPreset does so uploading an image doesn't snap the box
          // to (0, 0).
          const naturalLayout = computeRowLayout(
            [
              { id: "__main__", frame: canvas.frame },
              ...updatedSlots.map((slot) => ({
                id: slot.id,
                frame: canvas.frame,
              })),
            ],
            stateCanvasAspect(state)
          )
          return {
            screenshotSlots: updatedSlots.map((slot, index) => {
              const config = activeLayoutGeometry.slots[index]
              if (!config) return slot
              const { xPct, yPct } = resolveSlotPositionPct({
                config,
                naturalSlotXPct: naturalLayout[index + 1]?.xPct ?? slot.xPct,
                relativeSlotPositions:
                  activeLayoutGeometry.relativeSlotPositions,
              })
              return {
                ...slot,
                xPct,
                yPct,
                rotation: config.rotation,
                tilt: config.tilt,
                scale: config.scale,
                ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
              }
            }),
          }
        },
        null
      )
    },
    applyCroppedScreenshotSlot: (id, src, region, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotSlots: canvas.screenshotSlots.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  src,
                  originalSrc: slot.originalSrc ?? slot.src,
                  lastCropRegion: region,
                }
              : slot
          ),
        }),
        `screenshot-slot-crop-${id}`
      ),
    deleteScreenshotSlot: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => ({
          screenshotSlots: removeSlotFromRow(
            canvas.screenshotSlots,
            id,
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
            zIndex: computeNextLayerZ(canvas),
          }
          return {
            screenshotSlots: placeNewSlotInRow(
              canvas.screenshotSlots,
              copy,
              canvas.frame,
              stateCanvasAspect(state)
            ),
          }
        },
        null
      )
      return didCopy ? copyId : null
    },
    bringScreenshotSlotToFront: slotLayerOps.toFront,
    sendScreenshotSlotToBack: slotLayerOps.toBack,
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
