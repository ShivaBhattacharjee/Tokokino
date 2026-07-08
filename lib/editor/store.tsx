"use client"

import { create } from "zustand"

import { DEFAULT_CLIP_DURATION_MS } from "./animation-motion"
import {
  clipAffectsMain,
  clipAffectsSlot,
  clipBaseline,
  clipPose,
  DEFAULT_BASELINE,
  REST_LIGHTING,
} from "./animation-playback"
import { MAX_DURATION_MS } from "./animation-timeline"
import { LAYOUT_PRESETS, PRESENT_PRESETS } from "./present-presets"
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
  AnimationAudio,
  AnimationClip,
  AnimationClipTarget,
  AnimationEffect,
  ClipBaseline,
  ClipSlotPose,
  CanvasAnimation,
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

/** Smallest an animation clip may be trimmed/fitted to (keep in sync with the
 * timeline UI's MIN_CLIP_MS). */
const MIN_ANIMATION_CLIP_MS = 200

/** Effects an extra screenshot slot can actually animate (its keyframe pose only
 * carries transform + shadow). Used to decide when editing an effect may auto-
 * bind an unbound keyframe to a slot. */
const SLOT_ANIMATABLE_EFFECTS: AnimationEffect[] = ["tilt", "zoom", "shadow"]

/** Canvas.animation is optional (older drafts) — always read through this. */
const getCanvasAnimation = (canvas: CanvasState): CanvasAnimation =>
  canvas.animation ?? { durationMs: 5000, clips: [], audio: null }

/** Snapshot the canvas's animatable state as a clip's target keyframe (pose). */
const captureClipPose = (canvas: CanvasState): ClipBaseline => ({
  tilt: canvas.tilt,
  scale: canvas.scale,
  screenshotPosition: canvas.screenshotPosition,
  screenshotOffset: canvas.screenshotOffset,
  padding: canvas.padding,
  canvasBorderRadius: canvas.canvasBorderRadius,
  shadow: canvas.shadow,
  backdropEffects: canvas.backdrop.effects,
  lighting: canvas.backdrop.lighting,
  background: canvas.background,
  filter: canvas.backdrop.filter,
  portrait: canvas.portrait,
  pattern: canvas.backdrop.pattern,
  overlay: canvas.overlay,
  slots: Object.fromEntries(
    canvas.screenshotSlots.map((s) => [
      s.id,
      {
        tilt: s.tilt,
        scale: s.scale,
        rotation: s.rotation,
        // Slots fall back to the canvas shadow when they have none of their own.
        shadow: s.shadow ?? canvas.shadow,
      },
    ])
  ),
})

/**
 * Load a clip's pose onto the canvas's live/committed style so the inspector and
 * canvas show that clip's keyframe. Slots not present in the pose keep their
 * current transform.
 */
const applyPoseToCanvas = (
  canvas: CanvasState,
  pose: ClipBaseline
): Partial<CanvasState> => ({
  tilt: pose.tilt,
  scale: pose.scale,
  screenshotPosition: pose.screenshotPosition,
  screenshotOffset: pose.screenshotOffset,
  padding: pose.padding,
  // Fall back to the live value for poses captured before this field existed.
  canvasBorderRadius: pose.canvasBorderRadius ?? canvas.canvasBorderRadius,
  shadow: pose.shadow,
  background: pose.background,
  // Fall back to the live value for poses captured before portrait animated.
  portrait: pose.portrait ?? canvas.portrait,
  // Fall back to the live value for poses captured before overlay animated.
  overlay: pose.overlay ?? canvas.overlay,
  backdrop: {
    ...canvas.backdrop,
    effects: pose.backdropEffects,
    // Fall back to the live value for poses captured before lighting animated.
    lighting: pose.lighting ?? canvas.backdrop.lighting,
    // Fall back to the live value for poses captured before filter animated.
    filter: pose.filter ?? canvas.backdrop.filter,
    // Fall back to the live value for poses captured before pattern animated.
    pattern: pose.pattern ?? canvas.backdrop.pattern,
  },
  screenshotSlots: canvas.screenshotSlots.map((s) => {
    const sp = pose.slots[s.id]
    if (!sp) return s
    return {
      ...s,
      tilt: sp.tilt,
      scale: sp.scale,
      rotation: sp.rotation,
      // Only overwrite the slot's shadow when the pose captured one (older poses
      // are transform-only, so leave the committed shadow untouched there).
      ...(sp.shadow ? { shadow: sp.shadow } : {}),
    }
  }),
})

/**
 * The resolved look AT a keyframe: for each effect, the value from the latest
 * keyframe that owns it at/before `target` (so held effects from earlier
 * keyframes show through), falling back to the final look for effects no
 * keyframe animates. Loading THIS onto the canvas makes selecting a keyframe show
 * its true accumulated state — which is what you edit.
 */
const REST_SHADOW: Shadow = {
  type: "none",
  intensity: 0,
  color: "#000000",
  lightSource: "center",
}

const resolveKeyframePose = (
  canvas: CanvasState,
  clips: AnimationClip[],
  target: AnimationClip
): ClipBaseline => {
  const sorted = [...clips].sort((a, b) => a.startMs - b.startMs)
  const last = sorted[sorted.length - 1]
  const fallback = last ? clipPose(last) : captureClipPose(canvas)

  // Latest keyframe that owns an effect at/before `target`, plus whether ANY
  // keyframe owns it — so we can tell "held from an earlier keyframe" apart from
  // "revealed by a later keyframe" (→ neutral rest) apart from "never animated"
  // (→ the constant final value).
  const latestOwner = (
    owns: (c: AnimationClip) => boolean
  ): { at: AnimationClip | null; any: boolean } => {
    let at: AnimationClip | null = null
    let any = false
    for (const c of clips) {
      if (!owns(c)) continue
      any = true
      if (c.startMs <= target.startMs && (!at || c.startMs >= at.startMs))
        at = c
    }
    return { at, any }
  }
  const ownsMain = (effect: AnimationEffect) => (c: AnimationClip) =>
    clipAffectsMain(c) && (c.effects ?? []).includes(effect)
  const ownsSlot =
    (slotId: string, effect: AnimationEffect) => (c: AnimationClip) =>
      clipAffectsSlot(c, slotId) && (c.effects ?? []).includes(effect)

  const main = <V,>(
    effect: AnimationEffect,
    extract: (p: ClipBaseline) => V,
    rest: V
  ): V => {
    const { at, any } = latestOwner(ownsMain(effect))
    if (at) return extract(clipPose(at))
    return any ? rest : extract(fallback)
  }

  return {
    tilt: main("tilt", (p) => p.tilt, { rx: 0, ry: 0, rz: 0 }),
    scale: main("zoom", (p) => p.scale, 100),
    screenshotPosition: main("position", (p) => p.screenshotPosition, "center"),
    screenshotOffset: main("position", (p) => p.screenshotOffset, {
      x: 0,
      y: 0,
    }),
    padding: main("padding", (p) => p.padding, 0),
    canvasBorderRadius: main(
      "canvasRadius",
      (p) => p.canvasBorderRadius ?? canvas.canvasBorderRadius,
      DEFAULT_BASELINE.canvasBorderRadius
    ),
    shadow: main("shadow", (p) => p.shadow, REST_SHADOW),
    // Background is a single layer (no true crossfade), so always show the final.
    background: (() => {
      const { at } = latestOwner(ownsMain("background"))
      return at ? clipPose(at).background : fallback.background
    })(),
    // Filter chains via stacked layers like background: the resolved value at a
    // keyframe is the latest owner's filter (or the final look when unowned).
    filter: (() => {
      const { at } = latestOwner(ownsMain("filter"))
      return at ? (clipPose(at).filter ?? "none") : (fallback.filter ?? "none")
    })(),
    // Portrait crossfade-chains like filter: the resolved value at a keyframe is
    // the latest owner's portrait (or the final look when unowned).
    portrait: (() => {
      const { at } = latestOwner(ownsMain("portrait"))
      const resolved = at ? clipPose(at).portrait : fallback.portrait
      return resolved ?? canvas.portrait
    })(),
    // Pattern crossfade-chains like portrait: resolved value = latest owner's
    // pattern (or the final look when unowned).
    pattern: (() => {
      const { at } = latestOwner(ownsMain("pattern"))
      const resolved = at ? clipPose(at).pattern : fallback.pattern
      return resolved ?? canvas.backdrop.pattern
    })(),
    // Overlay crossfade-chains like pattern: resolved value = latest owner's
    // overlay (or the final look when unowned).
    overlay: (() => {
      const { at } = latestOwner(ownsMain("overlay"))
      const resolved = at ? clipPose(at).overlay : fallback.overlay
      return resolved ?? canvas.overlay
    })(),
    backdropEffects: main(
      "backdrop",
      (p) => p.backdropEffects,
      DEFAULT_BASELINE.backdropEffects
    ),
    lighting: main(
      "lighting",
      (p) => p.lighting ?? canvas.backdrop.lighting,
      REST_LIGHTING
    ),
    slots: Object.fromEntries(
      canvas.screenshotSlots.map((s) => {
        const committed: ClipSlotPose = {
          tilt: s.tilt,
          scale: s.scale,
          rotation: s.rotation,
          shadow: s.shadow ?? canvas.shadow,
        }
        const slot = (effect: AnimationEffect, rest: ClipSlotPose) => {
          const { at, any } = latestOwner(ownsSlot(s.id, effect))
          if (at) return clipPose(at).slots[s.id] ?? rest
          return any ? rest : committed
        }
        const t = slot("tilt", {
          ...committed,
          tilt: { rx: 0, ry: 0, rz: 0 },
          rotation: 0,
        })
        const z = slot("zoom", { ...committed, scale: 100 })
        const sh = slot("shadow", { ...committed, shadow: REST_SHADOW })
        return [
          s.id,
          {
            tilt: t.tilt,
            rotation: t.rotation,
            scale: z.scale,
            shadow: sh.shadow ?? committed.shadow,
          },
        ]
      })
    ),
  }
}

/**
 * Which screenshot a newly-added clip should bind to, mirroring the inspector's
 * ScreenshotStyleTarget: a selected slot → that slot, else the main screenshot
 * if it's selected, else "all". Validates the slot still exists on `canvas`.
 */
const resolveSelectionTarget = (
  canvas: CanvasState,
  selectedScreenshotSlotId: string | null,
  isScreenshotSelected: boolean
): AnimationClipTarget => {
  if (
    selectedScreenshotSlotId &&
    canvas.screenshotSlots.some((s) => s.id === selectedScreenshotSlotId)
  ) {
    return { scope: "slot", slotId: selectedScreenshotSlotId }
  }
  if (isScreenshotSelected) return { scope: "main" }
  return { scope: "all" }
}

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
  setIsAnimateMode: (a: boolean) => void
  /**
   * Open a clip for editing: saves the currently-open clip's pose from the live
   * canvas, then loads the newly-selected clip's pose onto the canvas so the
   * inspector edits that clip's keyframe. Pass null to deselect.
   */
  selectAnimationClip: (id: string | null, canvasId?: string) => void
  setAnimationDuration: (ms: number, canvasId?: string) => void
  addAnimationClip: (canvasId?: string, atMs?: number) => string
  updateAnimationClip: (
    id: string,
    patch: Partial<Omit<AnimationClip, "id">>,
    canvasId?: string
  ) => void
  /**
   * Strip every animated effect from a clip: reverts its pose to its captured
   * baseline and clears `effects` so it animates nothing. When it's the open
   * clip, the committed canvas reverts too (so e.g. a lit backdrop goes dark).
   */
  clearAnimationClipEffects: (id: string, canvasId?: string) => void
  removeAnimationClip: (id: string, canvasId?: string) => void
  moveAnimationClip: (id: string, startMs: number, canvasId?: string) => void
  duplicateAnimationClip: (id: string, canvasId?: string) => string | null
  clearAnimationClips: (canvasId?: string) => void
  setAnimationAudio: (audio: AnimationAudio | null, canvasId?: string) => void
  updateAnimationAudio: (
    patch: Partial<AnimationAudio>,
    canvasId?: string
  ) => void
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
  isAnimateMode: boolean
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
  /** Timeline clip currently open for editing in Animate mode (its keyframe). */
  selectedAnimationClipId: string | null
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

  /**
   * Like `commitCanvas`, but while a keyframe is open in Animate mode it also
   * records `effects` as owned by that keyframe. This is how "changing an effect
   * while a clip is selected makes that clip own it" — the ONLY thing a keyframe
   * animates is the effect set recorded here.
   */
  const commitCanvasEffect = (
    targetId: string | undefined,
    patch: CanvasPatch,
    group: string | null,
    effects: AnimationEffect | AnimationEffect[]
  ) => {
    const list = Array.isArray(effects) ? effects : [effects]
    commitCanvas(
      targetId,
      (canvas, state) => {
        const base = typeof patch === "function" ? patch(canvas, state) : patch
        const full = get()
        const selId = full.selectedAnimationClipId
        if (!full.isAnimateMode || !selId) return base
        const anim = getCanvasAnimation(canvas)
        const clip = anim.clips.find((c) => c.id === selId)
        if (!clip) return base
        const owned = clip.effects ?? []
        const merged = Array.from(new Set([...owned, ...list]))
        // Auto-bind: an as-yet-unbound ("all") keyframe binds to the SLOT this
        // edit targets, so selecting it later re-selects that slot and further
        // edits scope to it. Only for the effects a slot can actually animate
        // (transform + shadow) — main-only effects like position always edit the
        // main even when a slot is selected, so they must not re-bind the clip.
        // A keyframe already bound keeps its binding.
        const currentTarget = clip.target ?? { scope: "all" as const }
        const nextTarget = resolveSelectionTarget(
          canvas,
          full.selectedScreenshotSlotId,
          full.isScreenshotSelected
        )
        const retarget =
          currentTarget.scope === "all" &&
          nextTarget.scope === "slot" &&
          list.every((e) => SLOT_ANIMATABLE_EFFECTS.includes(e))
        if (list.every((e) => owned.includes(e)) && !retarget) return base
        return {
          ...base,
          animation: {
            ...anim,
            clips: anim.clips.map((c) =>
              c.id === selId
                ? {
                    ...c,
                    effects: merged,
                    ...(retarget ? { target: nextTarget } : {}),
                  }
                : c
            ),
          },
        }
      },
      group
    )
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
    isAnimateMode: false,
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
    selectedAnimationClipId: null,
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
              // Single presets track the canvas' current zoom (tilt-only).
              screenshotSlots = screenshotSlots.map((slot) => ({
                ...slot,
                yPct: 50,
                rotation: 0,
                tilt: activeSinglePreset.tilt,
                scale: canvas.scale,
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
                    ? canvas.scale
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
            // Single presets track the canvas' current zoom (tilt-only).
            screenshotSlots = screenshotSlots.map((slot) => ({
              ...slot,
              yPct: 50,
              rotation: 0,
              tilt: activeSinglePreset.tilt,
              scale: canvas.scale,
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
                  ? canvas.scale
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
      commitCanvasEffect(
        canvasId,
        { background: b },
        "background",
        "background"
      ),
    setPadding: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          padding: n,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, {
            padding: n,
          }),
        }),
        "padding",
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
      commitCanvasEffect(
        canvasId,
        { canvasBorderRadius: n },
        "canvasBorderRadius",
        "canvasRadius"
      ),
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
      commitCanvasEffect(canvasId, { padding: n }, "padding", "padding"),
    setMainScreenshotBorderRadius: (n, canvasId) =>
      commitCanvas(canvasId, { borderRadius: n }, "borderRadius"),
    setMainScreenshotBorder: (b, canvasId) =>
      commitCanvas(canvasId, { border: b }, "border"),
    setBackdropEffects: (e, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, effects: e } }),
        "backdrop-effects",
        "backdrop"
      ),
    setBackdropPattern: (p, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, pattern: p } }),
        "backdrop-pattern",
        "pattern"
      ),
    setBackdropLighting: (l, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          backdrop: { ...canvas.backdrop, lighting: l },
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            lighting: cloneLighting(l),
          })),
        }),
        "backdrop-lighting",
        "lighting"
      ),
    setMainScreenshotBackdropLighting: (l, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, lighting: l } }),
        "backdrop-lighting",
        "lighting"
      ),
    setBackdropFilter: (f, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, filter: f } }),
        "backdrop-filter",
        "filter"
      ),
    setTilt: (t, canvasId) =>
      commitCanvasEffect(canvasId, { tilt: t }, "tilt", "tilt"),
    setScale: (n, canvasId) =>
      commitCanvasEffect(canvasId, { scale: n }, "scale", "zoom"),
    setTiltAndScale: (t, scale, canvasId) =>
      commitCanvasEffect(canvasId, { tilt: t, scale }, "tilt-scale", [
        "tilt",
        "zoom",
      ]),
    setScreenshotTilt: (t, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          tilt: t,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            tilt: { ...t },
          })),
        }),
        "tilt",
        "tilt"
      ),
    setScreenshotScale: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          scale: n,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, { scale: n }),
        }),
        "scale",
        "zoom"
      ),
    setScreenshotRotation: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          tilt: { ...canvas.tilt, rz: n },
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, {
            rotation: n,
          }),
        }),
        "tilt",
        "tilt"
      ),
    setCanvasZoom: (n) => commit({ canvasZoom: n }, "canvasZoom"),
    setScreenshotPosition: (p, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
        "screenshotPosition",
        "position"
      ),
    setScreenshotOffset: (o, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotOffset: o },
        "screenshotOffset",
        "position"
      ),
    setScreenshotPlacement: (p, o, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotPosition: p, screenshotOffset: o },
        "screenshotPlacement",
        "position"
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
      commitCanvasEffect(
        canvasId,
        (canvas) => ({
          shadow: s,
          screenshotSlots: mirrorToSlots(canvas.screenshotSlots, () => ({
            shadow: cloneShadow(s),
          })),
        }),
        "shadow",
        "shadow"
      ),
    setMainScreenshotShadow: (s, canvasId) =>
      commitCanvasEffect(canvasId, { shadow: s }, "shadow", "shadow"),
    setOverlay: (o, canvasId) =>
      commitCanvasEffect(canvasId, { overlay: o }, "overlay", "overlay"),
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
      commitCanvasEffect(canvasId, { portrait: p }, "portrait", "portrait"),
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
    setIsAnimateMode: (a) => {
      const state = get()
      const canvas = state.present.canvases.find(
        (c) => c.id === state.present.activeCanvasId
      )
      if (!canvas) {
        set({ isAnimateMode: a, selectedAnimationClipId: null })
        return
      }
      const animation = getCanvasAnimation(canvas)
      const sorted = [...animation.clips].sort((x, y) => x.startMs - y.startMs)
      const last = sorted[sorted.length - 1]
      if (a) {
        // Entering: the committed canvas IS the final frame, so fold any edits
        // made outside Animate mode into the last clip's pose and open it for
        // editing. (No pose is loaded — the canvas already shows the end state.)
        if (!last) {
          set({ isAnimateMode: true, selectedAnimationClipId: null })
          return
        }
        const pose = captureClipPose(canvas)
        const nextClips = animation.clips.map((c) =>
          c.id === last.id ? { ...c, pose } : c
        )
        const canvases = state.present.canvases.map((c) =>
          c.id === canvas.id
            ? { ...c, animation: { ...animation, clips: nextClips } }
            : c
        )
        set({
          present: { ...state.present, canvases },
          isAnimateMode: true,
          selectedAnimationClipId: last.id,
        })
        return
      }
      // Exiting: persist the open clip's edits, then restore the committed canvas
      // to the last clip's pose (the animation's final frame) so the static
      // editor and exports show the end state. Clear the clip selection.
      const openId = state.selectedAnimationClipId
      let nextClips = animation.clips
      if (openId && nextClips.some((c) => c.id === openId)) {
        const pose = captureClipPose(canvas)
        nextClips = nextClips.map((c) => (c.id === openId ? { ...c, pose } : c))
      }
      const nextSorted = [...nextClips].sort((x, y) => x.startMs - y.startMs)
      const nextLast = nextSorted[nextSorted.length - 1]
      const canvasPatch = nextLast
        ? applyPoseToCanvas(canvas, clipPose(nextLast))
        : {}
      const canvases = state.present.canvases.map((c) =>
        c.id === canvas.id
          ? {
              ...c,
              ...canvasPatch,
              animation: { ...animation, clips: nextClips },
            }
          : c
      )
      set({
        present: { ...state.present, canvases },
        isAnimateMode: false,
        selectedAnimationClipId: null,
      })
    },
    selectAnimationClip: (id, canvasId) => {
      const state = get()
      // Re-selecting the already-open clip is a no-op: its live edits are in the
      // committed canvas; reloading its (not-yet-saved) stored pose would wipe
      // them. onClipPointerDown re-selects on every click, so this matters.
      if (id === state.selectedAnimationClipId) return
      const targetCanvasId = canvasId ?? state.present.activeCanvasId
      const canvas = state.present.canvases.find((c) => c.id === targetCanvasId)
      if (!canvas) {
        set({ selectedAnimationClipId: id })
        return
      }
      const animation = getCanvasAnimation(canvas)
      const openId = state.selectedAnimationClipId
      let nextClips = animation.clips
      // Persist the previously-open clip's edits from the live canvas.
      if (openId && openId !== id && nextClips.some((c) => c.id === openId)) {
        const pose = captureClipPose(canvas)
        nextClips = nextClips.map((c) => (c.id === openId ? { ...c, pose } : c))
      }
      // Load the resolved look AT this keyframe (its owned effects + those held
      // from earlier keyframes) so the inspector/canvas show what it really looks
      // like there and you can edit from that state.
      const opened = id ? nextClips.find((c) => c.id === id) : undefined
      const canvasPatch = opened
        ? applyPoseToCanvas(
            canvas,
            resolveKeyframePose(canvas, nextClips, opened)
          )
        : {}
      const canvases = state.present.canvases.map((c) =>
        c.id === canvas.id
          ? {
              ...c,
              ...canvasPatch,
              animation: { ...animation, clips: nextClips },
            }
          : c
      )
      // Point the inspector at the screenshot this clip targets, so edits route
      // to the right screenshot (main vs a slot) and get recorded as this clip's
      // effects. A slot target that no longer exists falls back to the main.
      const targetSelection = (() => {
        const t = opened?.target ?? { scope: "all" as const }
        if (
          t.scope === "slot" &&
          canvas.screenshotSlots.some((s) => s.id === t.slotId)
        ) {
          return { ...CLEAR_SELECTION, selectedScreenshotSlotId: t.slotId }
        }
        if (t.scope === "main") {
          return { ...CLEAR_SELECTION, isScreenshotSelected: true }
        }
        return { ...CLEAR_SELECTION }
      })()
      // Route through raw `set` (not commit) so navigating between clips does not
      // pile up undo history; property edits still commit normally.
      set({
        present: { ...state.present, canvases },
        selectedAnimationClipId: id,
        ...(opened ? targetSelection : {}),
      })
    },
    setAnimationDuration: (ms, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          animation: { ...getCanvasAnimation(canvas), durationMs: ms },
        }),
        "animation-duration"
      ),
    addAnimationClip: (canvasId, atMs) => {
      const id = makeId()
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const clipLen = Math.min(DEFAULT_CLIP_DURATION_MS, MAX_DURATION_MS)
          const sorted = [...animation.clips].sort(
            (a, b) => a.startMs - b.startMs
          )
          let startMs: number
          if (atMs != null) {
            // Drop the clip where the pointer released — allowed past the set
            // duration (clamped only to the absolute max range).
            const maxStart = Math.max(0, MAX_DURATION_MS - clipLen)
            startMs = Math.max(0, Math.min(maxStart, atMs))
          } else {
            // Append right after the last clip — allowed to run PAST the set
            // duration (clamped only to the absolute max range). Clips beyond the
            // duration are shown faded in the timeline to signal they won't play
            // until the duration is extended.
            const lastEnd = sorted.reduce(
              (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
              0
            )
            startMs = Math.min(lastEnd, Math.max(0, MAX_DURATION_MS - clipLen))
          }
          // Never overlap a neighbouring clip: keep the start past the previous
          // clip's end, and shrink the duration so it stops at the next clip.
          const prevEnd = sorted
            .filter((c) => c.startMs <= startMs)
            .reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0)
          startMs = Math.max(startMs, prevEnd)
          const nextStart = sorted
            .filter((c) => c.startMs >= startMs)
            .reduce((min, c) => Math.min(min, c.startMs), MAX_DURATION_MS)
          const fittedDuration = Math.max(
            MIN_ANIMATION_CLIP_MS,
            Math.min(clipLen, nextStart - startMs)
          )
          const snapshot = captureClipPose(canvas)
          const clip: AnimationClip = {
            id,
            startMs,
            durationMs: fittedDuration,
            target: resolveSelectionTarget(
              canvas,
              get().selectedScreenshotSlotId,
              get().isScreenshotSelected
            ),
            pose: snapshot,
            // The state BEFORE this keyframe's edits — captured at creation so an
            // effect (e.g. background) can cross-fade FROM the pre-edit value
            // rather than from a neutral/black origin. The canvas always has a
            // background, so the first background swap starts from this one.
            baseline: snapshot,
            // A fresh keyframe owns nothing until you edit an effect on it.
            effects: [],
          }
          return {
            animation: { ...animation, clips: [...animation.clips, clip] },
          }
        },
        null
      )
      return id
    },
    updateAnimationClip: (id, patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          return {
            animation: {
              ...animation,
              clips: animation.clips.map((clip) =>
                clip.id === id ? { ...clip, ...patch } : clip
              ),
            },
          }
        },
        `animation-clip:${id}`
      ),
    clearAnimationClipEffects: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const clip = animation.clips.find((c) => c.id === id)
          // Nothing owned → nothing to strip (and no canvas revert needed).
          if (!clip || (clip.effects ?? []).length === 0) return {}
          // Revert the clip to its captured start: pose = baseline, owns nothing.
          // Merge over DEFAULT_BASELINE so older clips missing newer pose fields
          // (e.g. lighting) still reset those to neutral instead of leaking the
          // committed value back through resolveKeyframePose's fallback.
          const cleared: AnimationClip = {
            ...clip,
            effects: [],
            pose: { ...DEFAULT_BASELINE, ...clipBaseline(clip) },
          }
          const nextClips = animation.clips.map((c) =>
            c.id === id ? cleared : c
          )
          // If this clip is open for editing, the committed canvas is showing its
          // (now-removed) effects — reload the resolved look WITHOUT this clip so
          // the canvas reflects the strip (e.g. the lit backdrop goes dark).
          const isOpen = get().selectedAnimationClipId === id
          const canvasPatch = isOpen
            ? applyPoseToCanvas(
                canvas,
                resolveKeyframePose(canvas, nextClips, cleared)
              )
            : {}
          return {
            ...canvasPatch,
            animation: { ...animation, clips: nextClips },
          }
        },
        `animation-clip:${id}`
      ),
    removeAnimationClip: (id, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          // Just drop the clip — the others keep their positions. The removed
          // clip fades out via AnimatePresence in the timeline view.
          return {
            animation: {
              ...animation,
              clips: animation.clips.filter((clip) => clip.id !== id),
            },
          }
        },
        null
      ),
    moveAnimationClip: (id, startMs, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          const moving = animation.clips.find((clip) => clip.id === id)
          if (!moving) return {}
          const dur = moving.durationMs
          const others = animation.clips.filter((clip) => clip.id !== id)
          // Where the clip was dropped, clamped to the absolute max range (it may
          // land past the set duration — that's fine, it just renders faded).
          const desired = Math.max(0, startMs)
          // Clips that stay before the drop point keep their spot; snap the drop
          // past the nearest one so we never overlap it.
          const prevEnd = others
            .filter((clip) => clip.startMs < desired)
            .reduce(
              (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
              0
            )
          const start = Math.min(
            Math.max(desired, prevEnd),
            Math.max(0, MAX_DURATION_MS - dur)
          )
          // Clips at/after the drop point ripple right just enough to open a gap
          // for the moved clip (preserving the spacing between them) — so
          // dropping between two clips inserts there instead of snapping away.
          const nextStart = others
            .filter((clip) => clip.startMs >= desired)
            .reduce((min, clip) => Math.min(min, clip.startMs), Infinity)
          const shift = Number.isFinite(nextStart)
            ? Math.max(0, start + dur - nextStart)
            : 0
          const clips = animation.clips.map((clip) => {
            if (clip.id === id) return { ...clip, startMs: start }
            if (clip.startMs < desired) return clip
            return {
              ...clip,
              startMs: Math.min(
                clip.startMs + shift,
                Math.max(0, MAX_DURATION_MS - clip.durationMs)
              ),
            }
          })
          // Duration is user-controlled via the end handle — moving a clip never
          // grows it; clips past the duration are just shown faded.
          return { animation: { ...animation, clips } }
        },
        // Merge with the drag's history entries so the whole gesture undoes once.
        `animation-clip:${id}`
      ),
    duplicateAnimationClip: (id, canvasId) => {
      const state = get().present
      const resolvedId = canvasId ?? state.activeCanvasId
      const canvas = state.canvases.find((c) => c.id === resolvedId)
      const source = canvas
        ? getCanvasAnimation(canvas).clips.find((clip) => clip.id === id)
        : undefined
      if (!source) return null
      const newId = makeId()
      commitCanvas(
        canvasId,
        (c) => {
          const animation = getCanvasAnimation(c)
          const dur = source.durationMs
          // The copy sits immediately after the original (clamped to the max
          // range; it may land past the set duration and render faded).
          const insertStart = Math.min(
            source.startMs + dur,
            Math.max(0, MAX_DURATION_MS - dur)
          )
          // Push clips at/after the insertion point to the right, but only far
          // enough to open a gap for the copy — this preserves the spacing
          // between the shifted clips instead of scattering them.
          const nextStart = animation.clips
            .filter(
              (clip) => clip.id !== source.id && clip.startMs >= insertStart
            )
            .reduce((min, clip) => Math.min(min, clip.startMs), Infinity)
          const shift = Number.isFinite(nextStart)
            ? Math.max(0, insertStart + dur - nextStart)
            : 0
          const shifted = animation.clips.map((clip) =>
            clip.id !== source.id && clip.startMs >= insertStart
              ? {
                  ...clip,
                  startMs: Math.min(
                    clip.startMs + shift,
                    Math.max(0, MAX_DURATION_MS - clip.durationMs)
                  ),
                }
              : clip
          )
          const clip: AnimationClip = {
            ...source,
            id: newId,
            startMs: insertStart,
          }
          // Insert the copy right after the original in the array so it renders
          // between the two, not appended at the end.
          const sourceIndex = shifted.findIndex((cl) => cl.id === source.id)
          const clips = [
            ...shifted.slice(0, sourceIndex + 1),
            clip,
            ...shifted.slice(sourceIndex + 1),
          ]
          // Duration is user-controlled — the copy never grows it; a copy past
          // the duration is just shown faded.
          return { animation: { ...animation, clips } }
        },
        null
      )
      return newId
    },
    clearAnimationClips: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          animation: { ...getCanvasAnimation(canvas), clips: [] },
        }),
        null
      ),
    setAnimationAudio: (audio, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          animation: { ...getCanvasAnimation(canvas), audio },
        }),
        null
      ),
    updateAnimationAudio: (patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          const animation = getCanvasAnimation(canvas)
          if (!animation.audio) return {}
          return {
            animation: {
              ...animation,
              audio: { ...animation.audio, ...patch },
            },
          }
        },
        "animation-audio"
      ),
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
    updateScreenshotSlot: (id, patch, canvasId) => {
      const apply = (canvas: CanvasState) => ({
        screenshotSlots: canvas.screenshotSlots.map((slot) =>
          slot.id === id ? { ...slot, ...patch } : slot
        ),
      })
      // A slot's transform + shadow edits become owned effects on the open
      // keyframe; other slot changes (position, fit, filter…) don't animate, so
      // they commit normally.
      const effects: AnimationEffect[] = []
      if ("tilt" in patch || "rotation" in patch) effects.push("tilt")
      if ("scale" in patch) effects.push("zoom")
      if ("shadow" in patch) effects.push("shadow")
      if (effects.length === 0) {
        commitCanvas(canvasId, apply, `screenshot-slot-${id}`)
      } else {
        commitCanvasEffect(canvasId, apply, `screenshot-slot-${id}`, effects)
      }
    },
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
