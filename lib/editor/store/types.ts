import type { PresetSort } from "@/lib/schemas/preset"

import type { CustomPresetCanvasStyle } from "../preset-fields"
import type {
  Annotation,
  AnnotationPoint,
  AnnotationShape,
  AnnotationStroke,
  AnimationClip,
  AspectState,
  AssetElement,
  AssetFilter,
  Background,
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
  MediaAdjustments,
  Overlay,
  Portrait,
  ScreenshotLayer,
  ScreenshotPosition,
  ScreenshotSlot,
  Shadow,
  TextElement,
  Tilt,
  TweetCard,
  VideoTimelineClip,
} from "../state-types"
import type {
  PresetTab,
  ScreenshotStylePatch,
  ScreenshotStyleTarget,
} from "./canvas-helpers"
import type { CurrentDraftInfo } from "./draft-persistence"

export type SetPatch =
  | Partial<EditorState>
  | ((state: EditorState) => Partial<EditorState>)

export type CanvasPatch =
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
  adjustments?: MediaAdjustments
  hidden?: boolean
  objectFit?: "contain" | "cover" | "fill"
  shadow?: Shadow
}
/**
 * Full visual snapshot of a canvas that gets re-applied when a custom preset is
 * selected — every styling field but never the actual screenshot pixels. The
 * exact field set is derived from {@link PRESET_NON_STYLE_KEYS}: capture, apply,
 * and preview all read it from `preset-fields` so a new canvas styling field
 * flows into presets with no change here.
 */
export type { CustomPresetCanvasStyle }

/** User-saved custom preset kind: static look vs timeline (animate). */
export type CustomPresetType = "style" | "animate"

/**
 * Timeline payload for animate presets. Audio is never stored; clip/slot ids
 * are remapped on apply via `sourceSlotIds` (geometry.slots order).
 */
export type CustomPresetAnimation = {
  durationMs: number
  clips: AnimationClip[]
  /** Slot ids from the source canvas at save time, in geometry.slots order. */
  sourceSlotIds?: string[]
}

export type CustomPresetGeometry = {
  canvasTilt: Tilt
  canvasScale: number
  slots: CustomPresetSlotConfig[]
  mainOffset?: { xPct: number; yPct: number }
  relativeSlotPositions?: boolean
  canvasStyle?: CustomPresetCanvasStyle
  animation?: CustomPresetAnimation
}

export type CustomPresetSummary = {
  id: string
  name: string
  slotCount: number
  /** Defaults to "style" for older presets that predate the column. */
  type?: CustomPresetType
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
  /** When true, re-enter Animate mode after loading the project. */
  isAnimateMode?: boolean
}

export type EditorActions = {
  setTopBarPopoverOpen: (open: boolean) => void
  setActiveTool: (t: EditorTool) => void
  setPresetTab: (tab: PresetTab) => void
  setActiveLayoutPresetId: (id: string | null) => void
  setActiveCustomPresetId: (id: string | null) => void
  setActiveSinglePresetId: (id: string | null) => void
  setCustomPresets: (presets: CustomPresetSummary[]) => void
  /** Logout / session clear — empties the list without marking a successful load. */
  clearCustomPresets: () => void
  /**
   * Fetch the signed-in user's custom presets once. Dedupes in-flight calls so
   * multiple mounted Preset sections (desktop + iPad sidebars) share one request.
   */
  loadCustomPresets: (userId: string, sort?: PresetSort) => void
  addCustomPreset: (preset: CustomPresetSummary) => void
  updateCustomPreset: (id: string, patch: Partial<CustomPresetSummary>) => void
  removeCustomPreset: (id: string) => void
  setCurrentDraft: (draft: CurrentDraftInfo | null) => void
  loadDraftState: (
    state: Partial<EditorState>,
    draft: CurrentDraftInfo,
    ui?: DraftLoadUi
  ) => void
  /**
   * Apply a bundled template's full composition as a brand-new, unsaved
   * project. Same restore path as {@link loadDraftState} but never links to a
   * saved draft, so the next Save creates a fresh draft.
   */
  loadTemplateState: (state: Partial<EditorState>, ui?: DraftLoadUi) => void
  applyPresetSnapshot: (
    snapshot: CustomPresetGeometry,
    canvasId?: string
  ) => void
  setScreenshot: (s: string | null, canvasId?: string) => void
  setFullPageScreenshot: (src: string | null, canvasId?: string) => void
  setFullPageScreenshotScrollPosition: (
    scrollPosition: number,
    canvasId?: string
  ) => void
  applyCroppedScreenshot: (
    s: string,
    region: CropRegion,
    canvasId?: string
  ) => void
  // Non-destructive crop: stores a render-time crop region without re-encoding
  // or replacing the screenshot src. Used for video, which can't be re-encoded
  // client-side; passing null clears the crop.
  setScreenshotCropRegion: (
    region: CropRegion | null,
    canvasId?: string
  ) => void
  /** Update the placement or non-destructive in/out range of one video section. */
  updateVideoClip: (
    id: string,
    patch: Partial<Omit<VideoTimelineClip, "id">>,
    canvasId?: string
  ) => void
  /** Split a video section at a source-timeline time. */
  splitVideoClip: (id: string, atMs: number, canvasId?: string) => string | null
  /** Copy a video section and insert it after its source range. */
  duplicateVideoClip: (
    id: string,
    durationMs: number,
    canvasId?: string
  ) => string | null
  /** Delete one or more video sections. */
  removeVideoClips: (ids: string[], canvasId?: string) => void
  setAspect: (a: AspectState) => void
  setCanvasAspect: (canvasId: string, a: AspectState) => void
  setBackground: (
    b: Background,
    canvasId?: string,
    opts?: { silent?: boolean }
  ) => void
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
  /**
   * Single entry point for screenshot style edits. `target` decides whether the
   * patch lands on the main screenshot, a specific slot, or all of them; the
   * inspector uses this instead of picking between main/all/slot setters.
   */
  applyScreenshotStyle: (
    target: ScreenshotStyleTarget,
    patch: ScreenshotStylePatch,
    canvasId?: string
  ) => void
  setOverlay: (o: Overlay, canvasId?: string) => void
  setFrame: (f: DeviceFrame, canvasId?: string) => void
  setFrameForMatchingScreenshots: (f: DeviceFrame, canvasId?: string) => void
  setMainScreenshotFrame: (f: DeviceFrame, canvasId?: string) => void
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
  /**
   * Replace the timeline selection with `ids` (a marquee drag). One id behaves
   * exactly like `selectAnimationClip`; several select a group for bulk actions
   * and open no single keyframe for editing.
   */
  setAnimationClipSelection: (ids: string[], canvasId?: string) => void
  /** Bulk-delete every clip in `ids` in a single history entry. */
  removeAnimationClips: (ids: string[], canvasId?: string) => void
  /** Bulk "remove effects" — strip animated effects from every clip in `ids`. */
  clearAnimationClipsEffects: (ids: string[], canvasId?: string) => void
  /** Bulk-duplicate every clip in `ids`; returns the new clip ids. */
  duplicateAnimationClips: (ids: string[], canvasId?: string) => string[]
  /**
   * Cut a clip in two at `atMs` (like a razor tool). The first half keeps the
   * original id/pose; the second half is a new clip holding the same target
   * keyframe. Together they fill the original clip's exact footprint, so each
   * can then be dragged/trimmed on its own. Returns the new (second) clip id, or
   * null if the cut leaves either side smaller than the minimum clip length.
   */
  splitAnimationClip: (
    id: string,
    atMs: number,
    canvasId?: string
  ) => string | null
  clearAnimationClips: (canvasId?: string) => void
  setIsPreviewMode: (p: boolean) => void
  setIsPreviewAutoScroll: (a: boolean) => void
  setPreviewAutoScrollDelay: (d: number) => void
  setPreviewAnimation: (a: "slide" | "fade" | "zoom" | "flip") => void
  setBulkEditMode: (b: boolean) => void
  setBulkCanvasDragging: (dragging: boolean) => void
  setScreenshotPositionDragging: (dragging: boolean) => void
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
  setFullPageScreenshotSlot: (
    id: string,
    src: string | null,
    canvasId?: string
  ) => void
  setFullPageScreenshotSlotScrollPosition: (
    id: string,
    scrollPosition: number,
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

export type EditorStoreState = {
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
  /** True while a screenshot/slot is being moved via the position pad (not the
   * on-canvas box drag). Lets the boxes drop their left/top/transform easing so
   * they track the pad live instead of easing ~300ms behind it. */
  screenshotPositionDragging: boolean
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
  /**
   * Every clip selected in the timeline — the set bulk context-menu / keyboard
   * actions operate on. Contains `selectedAnimationClipId` when a single clip is
   * open; a marquee drag can select several (then no single clip is "open" for
   * editing, so `selectedAnimationClipId` is null).
   */
  selectedAnimationClipIds: string[]
  presetTab: PresetTab
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  activeSinglePresetId: string | null
  customPresets: CustomPresetSummary[]
  customPresetsLoaded: boolean
  customPresetsLoading: boolean
  /**
   * Set when the last load failed. Without it a failed fetch is indistinguishable
   * from an empty account, and the picker tells the user they have no presets
   * saved while their presets are sitting on the server.
   */
  customPresetsError: boolean
  /** User id the current `customPresets` list was fetched for. */
  customPresetsForUserId: string | null
  /**
   * Sort currently requested — drives the sort dropdown. Leads the displayed
   * list while a re-sort request is in flight.
   */
  customPresetsSort: PresetSort
  /**
   * Sort the displayed `customPresets` list is actually ordered by. Updated only
   * once a sort response lands, so `addCustomPreset` and failure rollback use the
   * order the user is really looking at rather than a pending request.
   */
  customPresetsListSort: PresetSort
  currentDraft: CurrentDraftInfo | null
}

export type EditorStore = EditorStoreState & EditorActions
