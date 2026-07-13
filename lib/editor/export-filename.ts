/**
 * Export filename templating.
 *
 * Users can define a filename format with variable tokens (e.g.
 * `{TEMPLATE}_{SCALE}_{DATE}`). Signed-out users get the format persisted
 * locally in IndexedDB; signed-in users get it synced to their account
 * (see `app/api/preferences/route.ts`). Applied by still-image export
 * (`lib/editor/export.ts`) and video/animation export downloads.
 */

import { useEditorStore } from "./store"

const PREFERENCES_DB_NAME = "tokokino-preferences"
const PREFERENCES_STORE_NAME = "preferences"
const PREFERENCES_DB_VERSION = 1

function openPreferencesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"))
      return
    }
    const request = window.indexedDB.open(
      PREFERENCES_DB_NAME,
      PREFERENCES_DB_VERSION
    )
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PREFERENCES_STORE_NAME)) {
        db.createObjectStore(PREFERENCES_STORE_NAME)
      }
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open preferences database"))
    request.onsuccess = () => resolve(request.result)
  })
}

async function readStoredPreference(key: string): Promise<string | null> {
  try {
    const db = await openPreferencesDb()
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(PREFERENCES_STORE_NAME, "readonly")
      const request = tx.objectStore(PREFERENCES_STORE_NAME).get(key)
      request.onsuccess = () =>
        resolve((request.result as string | undefined) ?? null)
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to read preference"))
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

async function writeStoredPreference(
  key: string,
  value: string | null
): Promise<void> {
  try {
    const db = await openPreferencesDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PREFERENCES_STORE_NAME, "readwrite")
      const store = tx.objectStore(PREFERENCES_STORE_NAME)
      if (value === null) store.delete(key)
      else store.put(value, key)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () =>
        reject(tx.error ?? new Error("Failed to write preference"))
    })
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export const EXPORT_FILENAME_STORAGE_KEY = "tokokino:export-filename-format"
export const DEFAULT_EXPORT_FILENAME_FORMAT = "tokokino_export_{SCALE}_{DATE}"
export const EXPORT_FILENAME_FORMAT_MAX_LENGTH = 200

export type ExportFilenameVariable = {
  token: string
  label: string
}

export const EXPORT_FILENAME_VARIABLES: ExportFilenameVariable[] = [
  { token: "{DATE}", label: "Current date and time" },
  { token: "{TEMPLATE}", label: "Current template / preset" },
  { token: "{SCALE}", label: "Export scale (hd, 4k, …)" },
  { token: "{RES}", label: "Pixel size as width×height" },
  { token: "{WIDTH}", label: "Export width in pixels" },
  { token: "{HEIGHT}", label: "Export height in pixels" },
  { token: "{RANDOM}", label: "Random string" },
]

const TOKEN_PATTERN = /\{(DATE|TEMPLATE|SCALE|RES|RANDOM|WIDTH|HEIGHT)\}/g

export type ExportFilenameContext = {
  date: string
  template: string
  scale: string
  random: string
  width: number | string
  height: number | string
}

export async function getExportFilenameFormat(): Promise<string> {
  if (typeof window === "undefined") return DEFAULT_EXPORT_FILENAME_FORMAT
  const stored = await readStoredPreference(EXPORT_FILENAME_STORAGE_KEY)
  return stored && stored.trim() ? stored : DEFAULT_EXPORT_FILENAME_FORMAT
}

export async function setExportFilenameFormat(format: string): Promise<void> {
  if (typeof window === "undefined") return
  const trimmed = format.trim()
  if (!trimmed || trimmed === DEFAULT_EXPORT_FILENAME_FORMAT) {
    await writeStoredPreference(EXPORT_FILENAME_STORAGE_KEY, null)
  } else {
    await writeStoredPreference(EXPORT_FILENAME_STORAGE_KEY, trimmed)
  }
}

export function exportTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19)
}

export function randomFilenameToken(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/** Replace tokens then strip characters that are unsafe in filenames. */
export function applyExportFilenameFormat(
  format: string,
  ctx: ExportFilenameContext
): string {
  const values: Record<string, string> = {
    "{DATE}": ctx.date,
    "{TEMPLATE}": ctx.template,
    "{SCALE}": ctx.scale,
    "{RES}": `${ctx.width}x${ctx.height}`,
    "{RANDOM}": ctx.random,
    "{WIDTH}": String(ctx.width),
    "{HEIGHT}": String(ctx.height),
  }

  const replaced = format.replace(
    TOKEN_PATTERN,
    (match) => values[match] ?? match
  )

  const safe = replaced
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")

  return safe || "tokokino_export"
}

/** Resolve a `{TEMPLATE}` label from the active preset / aspect ratio. */
export function getExportTemplateLabel(canvasId: string): string {
  try {
    const state = useEditorStore.getState()
    if (state.activeCustomPresetId) {
      const preset = state.customPresets.find(
        (p) => p.id === state.activeCustomPresetId
      )
      if (preset?.name) return preset.name
    }
    const presetId =
      state.activeSinglePresetId ?? state.activeLayoutPresetId ?? null
    if (presetId) return presetId
    const canvas = state.present.canvases.find((c) => c.id === canvasId)
    const aspect = canvas?.aspect ?? state.present.aspect
    if (aspect?.w && aspect?.h) return `${aspect.w}x${aspect.h}`
  } catch {
    /* store not ready — fall through */
  }
  return "default"
}

/** Build the final download filename (without re-adding the extension). */
export function buildExportFilename(opts: {
  format: string
  scale: string
  template: string
  width: number
  height: number
  extension: string
}): string {
  const name = applyExportFilenameFormat(opts.format, {
    date: exportTimestamp(),
    template: opts.template,
    scale: opts.scale,
    random: randomFilenameToken(),
    width: opts.width,
    height: opts.height,
  })
  const ext = opts.extension.startsWith(".")
    ? opts.extension
    : `.${opts.extension}`
  return `${name}${ext}`
}

/** Load the saved format and build a download filename for any export type. */
export async function resolveExportDownloadFilename(opts: {
  canvasId: string
  scale: string
  width: number
  height: number
  extension: string
}): Promise<string> {
  return buildExportFilename({
    format: await getExportFilenameFormat(),
    scale: opts.scale,
    template: getExportTemplateLabel(opts.canvasId),
    width: opts.width,
    height: opts.height,
    extension: opts.extension,
  })
}
