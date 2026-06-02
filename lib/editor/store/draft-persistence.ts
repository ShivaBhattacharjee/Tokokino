import { BACKGROUND_LIBRARY } from "../presets"
import type { Background, CanvasState, EditorState } from "../state-types"

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

export const EDITOR_DRAFT_DB_NAME = "tokokino-editor"
export const EDITOR_DRAFT_STORE_NAME = "drafts"
// Screenshots live in a separate store as native Blobs — much faster IDB
// read/write than embedding base64 strings in JSON.
const SCREENSHOT_BLOB_STORE_NAME = "screenshot-blobs"
export const EDITOR_DRAFT_KEY = "current"
// Bumped to 2: adds the screenshot-blobs object store.
export const EDITOR_DRAFT_SCHEMA_VERSION = 2
export const EDITOR_DRAFT_SAVE_DELAY_MS = 250

// Prefix that marks a field as a reference into the blob store rather than
// an inline data URL.  Old v1 drafts with real data URLs are unaffected
// because data URLs start with "data:".
const BLOB_SENTINEL_PREFIX = "@idb:"

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

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

function isDataUrl(v: string | null | undefined): v is string {
  return typeof v === "string" && v.startsWith("data:")
}

function isObjectUrl(v: string | null | undefined): v is string {
  return typeof v === "string" && v.startsWith("blob:")
}

function isSentinel(v: string | null | undefined): v is string {
  return typeof v === "string" && v.startsWith(BLOB_SENTINEL_PREFIX)
}

// Tracks every Object URL we mint during hydration so the save path can look
// the original Blob back up cheaply. Without this we'd lose the blob on
// reload (Object URLs can't be serialised) or be forced to fetch them
// through XHR on every save, which defeats the point. The map is bounded by
// the number of distinct screenshots/backgrounds in the active project, so
// memory is fine — we drop entries when explicitly revoked.
const objectUrlBlobs = new Map<string, Blob>()

function blobToObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  objectUrlBlobs.set(url, blob)
  return url
}

function getBlobFromObjectUrl(url: string): Blob | null {
  return objectUrlBlobs.get(url) ?? null
}

// Safari/WebKit only guarantees that a Blob read from IndexedDB stays readable
// while the source database connection is open — once we `db.close()`, the
// IDB-backed bytes can be released and any Object URL minted from them resolves
// to a broken image ("sometimes" blank screenshots on reload). Copying the
// bytes into a fresh in-memory Blob before the connection closes severs that
// dependency. We also re-stamp a concrete image MIME type, since Safari refuses
// to render an Object URL whose Blob has an empty `type`.
async function materializeBlob(blob: Blob): Promise<Blob> {
  const buffer = await blob.arrayBuffer()
  const type =
    blob.type || sniffImageMime(new Uint8Array(buffer)) || "image/png"
  return new Blob([buffer], { type })
}

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 4) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    )
      return "image/png"
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      return "image/jpeg"
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
      return "image/gif"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp"
  return null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",")
  const header = dataUrl.slice(0, comma)
  const data = dataUrl.slice(comma + 1)
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png"
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ---------------------------------------------------------------------------
// Screenshot extraction (data URLs / object URLs → Blobs) for write path
// ---------------------------------------------------------------------------

type BlobMap = Record<string, Blob>

function extractField(
  value: string | null | undefined,
  key: string,
  blobs: BlobMap
): { sentinel: string } | null {
  if (isDataUrl(value)) {
    blobs[key] = dataUrlToBlob(value)
    return { sentinel: `${BLOB_SENTINEL_PREFIX}${key}` }
  }
  if (isObjectUrl(value)) {
    // Hydrated this session — reuse the Blob we still hold a ref to instead
    // of re-decoding from the rendered DOM. If the entry has gone missing
    // (e.g. user revoked the URL manually), fall through to "no extract"
    // so we don't accidentally write a stale blob entry.
    const blob = getBlobFromObjectUrl(value)
    if (blob) {
      blobs[key] = blob
      return { sentinel: `${BLOB_SENTINEL_PREFIX}${key}` }
    }
  }
  return null
}

function extractScreenshots(state: EditorState): {
  stripped: EditorState
  blobs: BlobMap
} {
  const blobs: BlobMap = {}

  const canvases = state.canvases.map((canvas) => {
    const result: CanvasState = { ...canvas }

    const screenshotExtract = extractField(
      canvas.screenshot,
      `screenshot:${canvas.id}`,
      blobs
    )
    if (screenshotExtract) result.screenshot = screenshotExtract.sentinel

    const originalExtract = extractField(
      canvas.originalScreenshot,
      `original:${canvas.id}`,
      blobs
    )
    if (originalExtract) result.originalScreenshot = originalExtract.sentinel

    if (canvas.background.type === "image") {
      const bgExtract = extractField(
        canvas.background.value,
        `bg:${canvas.id}`,
        blobs
      )
      if (bgExtract) {
        result.background = { ...canvas.background, value: bgExtract.sentinel }
      }
    }

    result.screenshotSlots = canvas.screenshotSlots.map((slot) => {
      const slotExtract = extractField(
        slot.src,
        `slot:${canvas.id}:${slot.id}`,
        blobs
      )
      if (!slotExtract) return slot
      return { ...slot, src: slotExtract.sentinel }
    })

    return result
  })

  return { stripped: { ...state, canvases }, blobs }
}

// ---------------------------------------------------------------------------
// Screenshot resolution (Blobs → data URLs) for read path
// ---------------------------------------------------------------------------

function readBlobsFromDb(
  db: IDBDatabase,
  keys: string[]
): Promise<Record<string, Blob>> {
  return new Promise<Record<string, Blob>>((resolve) => {
    const result: Record<string, Blob> = {}
    if (keys.length === 0) {
      resolve(result)
      return
    }
    const transaction = db.transaction(SCREENSHOT_BLOB_STORE_NAME, "readonly")
    const store = transaction.objectStore(SCREENSHOT_BLOB_STORE_NAME)
    let pending = keys.length

    const done = () => {
      if (--pending === 0) resolve(result)
    }

    for (const key of keys) {
      const req = store.get(key)
      req.onsuccess = () => {
        if (req.result instanceof Blob) result[key] = req.result
        done()
      }
      req.onerror = done
    }

    // Resolve even if the whole transaction errors (blob store may not exist
    // in an old v1 DB that hasn't been upgraded yet).
    transaction.onerror = () => resolve(result)
    transaction.onabort = () => resolve(result)
  })
}

async function resolveScreenshots(
  state: EditorState,
  db: IDBDatabase
): Promise<EditorState> {
  // Collect all sentinel keys that need to be resolved
  const keys: string[] = []
  for (const canvas of state.canvases) {
    if (isSentinel(canvas.screenshot))
      keys.push(canvas.screenshot.slice(BLOB_SENTINEL_PREFIX.length))
    if (isSentinel(canvas.originalScreenshot))
      keys.push(canvas.originalScreenshot.slice(BLOB_SENTINEL_PREFIX.length))
    if (
      canvas.background.type === "image" &&
      isSentinel(canvas.background.value)
    )
      keys.push(canvas.background.value.slice(BLOB_SENTINEL_PREFIX.length))
    for (const slot of canvas.screenshotSlots) {
      if (isSentinel(slot.src))
        keys.push(slot.src.slice(BLOB_SENTINEL_PREFIX.length))
    }
  }

  if (keys.length === 0) return state

  const blobMap = await readBlobsFromDb(db, keys)

  // Object URLs are O(1) — no FileReader, no base64 parse, browser decodes
  // the bitmap lazily when the <img> actually renders. That keeps the
  // hydration setState cheap and stops the post-refresh thundering herd
  // where every canvas re-rendered with a giant data URL at once.
  //
  // Materialize each Blob into memory *before* the caller closes the DB so the
  // Object URLs survive on Safari (see materializeBlob). Done in parallel to
  // keep hydration fast.
  const objectUrls: Record<string, string> = {}
  await Promise.all(
    Object.entries(blobMap).map(async ([key, blob]) => {
      objectUrls[key] = blobToObjectUrl(await materializeBlob(blob))
    })
  )

  const resolve = (v: string | null | undefined): string | null => {
    if (!isSentinel(v)) return v ?? null
    const key = v.slice(BLOB_SENTINEL_PREFIX.length)
    // If the blob is missing (corrupted store), fall back to null so the
    // canvas shows the empty-state rather than a broken reference.
    return objectUrls[key] ?? null
  }

  const canvases = state.canvases.map((canvas) => ({
    ...canvas,
    screenshot: resolve(canvas.screenshot),
    originalScreenshot: resolve(canvas.originalScreenshot),
    background:
      canvas.background.type === "image" && isSentinel(canvas.background.value)
        ? {
            ...canvas.background,
            value: resolve(canvas.background.value) ?? "",
          }
        : canvas.background,
    screenshotSlots: canvas.screenshotSlots.map((slot) => ({
      ...slot,
      src: resolve(slot.src),
    })),
  }))

  return { ...state, canvases }
}

// ---------------------------------------------------------------------------
// DB open
// ---------------------------------------------------------------------------

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
      if (!db.objectStoreNames.contains(SCREENSHOT_BLOB_STORE_NAME)) {
        db.createObjectStore(SCREENSHOT_BLOB_STORE_NAME)
      }
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open editor draft database"))
    request.onsuccess = () => resolve(request.result)
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function readEditorDraft(): Promise<PersistedEditorDraft | null> {
  return openEditorDraftDb().then(async (db) => {
    try {
      // Read the (now small) JSON draft record
      const draft = await new Promise<PersistedEditorDraft | null>(
        (resolve, reject) => {
          const tx = db.transaction(EDITOR_DRAFT_STORE_NAME, "readonly")
          const req = tx
            .objectStore(EDITOR_DRAFT_STORE_NAME)
            .get(EDITOR_DRAFT_KEY)
          req.onsuccess = () =>
            resolve((req.result as PersistedEditorDraft | undefined) ?? null)
          req.onerror = () =>
            reject(req.error ?? new Error("Failed to read editor draft"))
        }
      )
      if (!draft) {
        db.close()
        return null
      }
      // Resolve blob sentinels back to data URLs
      const present = await resolveScreenshots(draft.present, db)
      db.close()
      return { ...draft, present }
    } catch (err) {
      db.close()
      throw err
    }
  })
}

export function writeEditorDraft(draft: PersistedEditorDraft): Promise<void> {
  return openEditorDraftDb().then((db) => {
    return new Promise<void>((resolve, reject) => {
      // Extract screenshots synchronously before any async IDB operations so
      // we capture the state at the moment writeEditorDraft was called.
      const { stripped, blobs } = extractScreenshots(draft.present)
      const slimDraft: PersistedEditorDraft = { ...draft, present: stripped }
      const validKeys = new Set(Object.keys(blobs))

      const tx = db.transaction(
        [EDITOR_DRAFT_STORE_NAME, SCREENSHOT_BLOB_STORE_NAME],
        "readwrite"
      )
      const draftsStore = tx.objectStore(EDITOR_DRAFT_STORE_NAME)
      const blobsStore = tx.objectStore(SCREENSHOT_BLOB_STORE_NAME)

      // Write the slim JSON draft
      draftsStore.put(slimDraft)

      // Upsert current blobs
      for (const [key, blob] of Object.entries(blobs)) {
        blobsStore.put(blob, key)
      }

      // Delete orphaned blobs (canvases that were removed since last save)
      const keysReq = blobsStore.getAllKeys()
      keysReq.onsuccess = () => {
        for (const key of keysReq.result as string[]) {
          if (!validKeys.has(key)) blobsStore.delete(key)
        }
      }

      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error("Failed to save editor draft"))
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error ?? new Error("Editor draft save aborted"))
      }
    })
  })
}

// createEditorDraftSnapshot no longer clones the full state with
// JSON.parse(JSON.stringify) — that was O(screenshot-bytes) on every save.
// The blob extraction in writeEditorDraft captures the current state values
// synchronously, so the snapshot reference is safe.
export function createEditorDraftSnapshot(
  state: EditorStore
): PersistedEditorDraft {
  return {
    id: EDITOR_DRAFT_KEY,
    schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
    updatedAt: Date.now(),
    present: state.present,
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

// ---------------------------------------------------------------------------
// State normalization (unchanged — used on hydration)
// ---------------------------------------------------------------------------

const cloneEditorState = (state: EditorState): EditorState =>
  JSON.parse(JSON.stringify(state)) as EditorState

const backgroundEntriesByFullUrl = new Map(
  BACKGROUND_LIBRARY.flatMap((category) =>
    category.items.map((item) => [item.full, item] as const)
  )
)

function normalizeBackground(
  source: Partial<Background> | null | undefined,
  fallback: Background
): Background {
  const background = { ...fallback, ...(source ?? {}) }
  if (background.type !== "image") return background

  const sourceUrl = background.sourceUrl ?? background.value
  const libraryEntry = backgroundEntriesByFullUrl.get(sourceUrl)
  if (!libraryEntry) return background

  const isRawLibraryValue = background.value === libraryEntry.full
  return {
    ...background,
    value: isRawLibraryValue
      ? (libraryEntry.preview ?? libraryEntry.thumb)
      : background.value,
    sourceUrl: libraryEntry.full,
    thumbUrl: background.thumbUrl ?? libraryEntry.thumb,
  }
}

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
    background: normalizeBackground(source.background, fallback.background),
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

export function normalizeEditorState(state: Partial<EditorState>): EditorState {
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
