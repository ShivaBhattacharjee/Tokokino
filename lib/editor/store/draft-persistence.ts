import type { CanvasState, EditorState } from "../state-types"

import {
  applySlotStyleDefaults,
  CANVAS_BASE_W,
  CANVAS_GAP,
  makeId,
  migrateLegacySlot,
  type PresetTab,
} from "./canvas-helpers"
import {
  createCanvas,
  DEFAULT_STATE,
  FIRST_CANVAS_ID,
  CLEAR_SELECTION,
} from "./defaults"
import type { EditorStore } from "../store"

export const EDITOR_DRAFT_DB_NAME = "noctivy-editor"
export const EDITOR_DRAFT_STORE_NAME = "drafts"
export const EDITOR_DRAFT_KEY = "current"
export const EDITOR_DRAFT_SCHEMA_VERSION = 1
export const EDITOR_DRAFT_SAVE_DELAY_MS = 250

export type CurrentDraftInfo = {
  id: string
  name: string
  updatedAt: string | null
}

export type PreviewAnimation = "slide" | "fade" | "zoom" | "flip"

export type PersistedEditorUi = {
  bulkEditMode: boolean
  bulkViewportZoom: number
  bulkScale: number
  presetTab: PresetTab
  activeLayoutPresetId: string | null
  activeCustomPresetId: string | null
  activeSinglePresetId: string | null
  previewAutoScrollDelay: number
  previewAnimation: PreviewAnimation
  currentDraft: CurrentDraftInfo | null
}

export type PersistedEditorDraft = {
  id: typeof EDITOR_DRAFT_KEY
  schemaVersion: number
  updatedAt: number
  present: EditorState
  ui: PersistedEditorUi
}

export const isBrowserIndexedDbAvailable = () =>
  typeof window !== "undefined" && "indexedDB" in window

const cloneEditorState = (state: EditorState): EditorState =>
  JSON.parse(JSON.stringify(state)) as EditorState

function normalizeCanvasState(
  canvas: Partial<CanvasState> | null | undefined,
  fallback: CanvasState
): CanvasState {
  const source = canvas ?? {}
  const fallbackBackdrop = fallback.backdrop
  const sourceBackdrop = source.backdrop
  const normalized: CanvasState = {
    ...fallback,
    ...source,
    id: source.id ?? fallback.id,
    position: { ...fallback.position, ...(source.position ?? {}) },
    background: { ...fallback.background, ...(source.background ?? {}) },
    border: { ...fallback.border, ...(source.border ?? {}) },
    backdrop: {
      ...fallbackBackdrop,
      ...(sourceBackdrop ?? {}),
      effects: {
        ...fallbackBackdrop.effects,
        ...(sourceBackdrop?.effects ?? {}),
      },
      pattern: {
        ...fallbackBackdrop.pattern,
        ...(sourceBackdrop?.pattern ?? {}),
      },
      lighting: {
        ...fallbackBackdrop.lighting,
        ...(sourceBackdrop?.lighting ?? {}),
      },
    },
    tilt: { ...fallback.tilt, ...(source.tilt ?? {}) },
    screenshotOffset: {
      ...fallback.screenshotOffset,
      ...(source.screenshotOffset ?? {}),
    },
    screenshotLayer: {
      ...fallback.screenshotLayer,
      ...(source.screenshotLayer ?? {}),
    },
    shadow: { ...fallback.shadow, ...(source.shadow ?? {}) },
    overlay: { ...fallback.overlay, ...(source.overlay ?? {}) },
    frame: { ...fallback.frame, ...(source.frame ?? {}) },
    portrait: { ...fallback.portrait, ...(source.portrait ?? {}) },
    texts: Array.isArray(source.texts) ? source.texts : fallback.texts,
    assets: Array.isArray(source.assets) ? source.assets : fallback.assets,
    annotations: Array.isArray(source.annotations)
      ? source.annotations
      : fallback.annotations,
    annotationShapes: Array.isArray(source.annotationShapes)
      ? source.annotationShapes
      : fallback.annotationShapes,
    screenshotSlots: Array.isArray(source.screenshotSlots)
      ? source.screenshotSlots.map((slot) => migrateLegacySlot(slot))
      : fallback.screenshotSlots,
  }

  return {
    ...normalized,
    screenshotSlots: normalized.screenshotSlots.map((slot) =>
      applySlotStyleDefaults(slot, normalized)
    ),
  }
}

export function normalizeEditorState(
  state: Partial<EditorState>
): EditorState {
  const fallback = cloneEditorState(DEFAULT_STATE)
  const rawCanvases = Array.isArray(state.canvases) ? state.canvases : []
  const canvases =
    rawCanvases.length > 0
      ? rawCanvases.map((canvas, index) =>
          normalizeCanvasState(
            canvas,
            createCanvas(
              canvas?.id ?? makeId(),
              canvas?.position ?? {
                x: index * (CANVAS_BASE_W + CANVAS_GAP),
                y: 0,
              }
            )
          )
        )
      : fallback.canvases
  const activeCanvasId = canvases.some((c) => c.id === state.activeCanvasId)
    ? state.activeCanvasId
    : canvases[0]?.id

  return {
    ...fallback,
    ...state,
    aspect: { ...fallback.aspect, ...(state.aspect ?? {}) },
    annotation: { ...fallback.annotation, ...(state.annotation ?? {}) },
    canvases,
    activeCanvasId: activeCanvasId ?? FIRST_CANVAS_ID,
  }
}

function openEditorDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowserIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = window.indexedDB.open(
      EDITOR_DRAFT_DB_NAME,
      EDITOR_DRAFT_SCHEMA_VERSION
    )

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(EDITOR_DRAFT_STORE_NAME)) {
        db.createObjectStore(EDITOR_DRAFT_STORE_NAME, { keyPath: "id" })
      }
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open editor draft database"))
    request.onsuccess = () => resolve(request.result)
  })
}

export function readEditorDraft(): Promise<PersistedEditorDraft | null> {
  return new Promise((resolve, reject) => {
    void openEditorDraftDb()
      .then((db) => {
        const transaction = db.transaction(EDITOR_DRAFT_STORE_NAME, "readonly")
        const store = transaction.objectStore(EDITOR_DRAFT_STORE_NAME)
        const request = store.get(EDITOR_DRAFT_KEY)

        request.onerror = () => {
          db.close()
          reject(request.error ?? new Error("Failed to read editor draft"))
        }
        request.onsuccess = () => {
          db.close()
          resolve((request.result as PersistedEditorDraft | undefined) ?? null)
        }
      })
      .catch(reject)
  })
}

export function writeEditorDraft(draft: PersistedEditorDraft): Promise<void> {
  return new Promise((resolve, reject) => {
    void openEditorDraftDb()
      .then((db) => {
        const transaction = db.transaction(EDITOR_DRAFT_STORE_NAME, "readwrite")
        const store = transaction.objectStore(EDITOR_DRAFT_STORE_NAME)
        store.put(draft)

        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error ?? new Error("Failed to save editor draft"))
        }
        transaction.onabort = () => {
          db.close()
          reject(transaction.error ?? new Error("Editor draft save aborted"))
        }
      })
      .catch(reject)
  })
}

export function createEditorDraftSnapshot(
  state: EditorStore
): PersistedEditorDraft {
  return {
    id: EDITOR_DRAFT_KEY,
    schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
    updatedAt: Date.now(),
    present: cloneEditorState(state.present),
    ui: {
      bulkEditMode: state.bulkEditMode,
      bulkViewportZoom: state.bulkViewportZoom,
      bulkScale: state.bulkScale,
      presetTab: state.presetTab,
      activeLayoutPresetId: state.activeLayoutPresetId,
      activeCustomPresetId: state.activeCustomPresetId,
      activeSinglePresetId: state.activeSinglePresetId,
      previewAutoScrollDelay: state.previewAutoScrollDelay,
      previewAnimation: state.previewAnimation,
      currentDraft: state.currentDraft,
    },
  }
}

export function applyEditorDraft(
  draft: PersistedEditorDraft
): Partial<EditorStore> {
  const present = normalizeEditorState(draft.present)
  const ui = draft.ui

  return {
    past: [],
    present,
    future: [],
    _lastGroup: null,
    _lastTs: 0,
    isPreviewMode: false,
    isPreviewAutoScroll: false,
    previewAutoScrollDelay: ui?.previewAutoScrollDelay ?? 3000,
    previewAnimation: ui?.previewAnimation ?? "slide",
    bulkEditMode: ui?.bulkEditMode ?? present.canvases.length > 1,
    bulkCanvasDragging: false,
    bulkViewportZoom: ui?.bulkViewportZoom ?? 1,
    bulkScale: ui?.bulkScale ?? 65,
    ...CLEAR_SELECTION,
    presetTab: ui?.presetTab ?? "single",
    activeLayoutPresetId: ui?.activeLayoutPresetId ?? null,
    activeCustomPresetId: ui?.activeCustomPresetId ?? null,
    activeSinglePresetId: ui?.activeSinglePresetId ?? null,
    currentDraft: ui?.currentDraft ?? null,
  }
}
