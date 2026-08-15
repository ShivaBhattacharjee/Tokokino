"use client"

import { create } from "zustand"

import { createAnimationActions } from "./store/actions/animation"
import { createCanvasStyleActions } from "./store/actions/canvas-style"
import { createCanvasActions } from "./store/actions/canvases"
import { createLayerActions } from "./store/actions/layers"
import { createMediaActions } from "./store/actions/media"
import { createProjectActions } from "./store/actions/project"
import { createSessionActions } from "./store/actions/session"
import { createSlotActions } from "./store/actions/slots"
import { createCommitContext } from "./store/commit-context"
import { INITIAL_EDITOR_STORE_STATE } from "./store/initial-state"
import type { EditorStore } from "./store/types"

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

export { MAX_CANVASES, MAX_SCREENSHOT_SLOTS } from "./store/defaults"
export { captureClipPose } from "./store/animation-helpers"
export type { PresetTab } from "./store/canvas-helpers"
export type { CurrentDraftInfo } from "./store/draft-persistence"

export {
  CanvasPreviewScope,
  CanvasScope,
  useActiveCanvasField,
  useActiveCanvasId,
  useCanvasById,
  useCanvases,
  useCanvasPreviewMode,
  useCanvasScopeId,
  useCanvasSourceId,
  useEditor,
  useSelectedScreenshotSlot,
  type EditorContext,
} from "./store/use-editor"
export {
  EditorProvider,
  saveCurrentEditorDraft,
  saveEditorDraftBeforeAuth,
} from "./store/provider"

export type {
  CustomPresetAnimation,
  CustomPresetCanvasStyle,
  CustomPresetGeometry,
  CustomPresetSlotConfig,
  CustomPresetSummary,
  CustomPresetType,
  DraftLoadUi,
  EditorActions,
  EditorStore,
  EditorStoreState,
} from "./store/types"
export const useEditorStore = create<EditorStore>((set, get) => {
  const context = createCommitContext(set, get)

  return {
    ...INITIAL_EDITOR_STORE_STATE,

    ...createProjectActions(context),
    ...createMediaActions(context),
    ...createCanvasStyleActions(context),
    ...createLayerActions(context),
    ...createAnimationActions(context),
    ...createSessionActions(context),
    ...createCanvasActions(context),
    ...createSlotActions(context),
  }
})
