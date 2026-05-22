import { z } from "zod/v4"

import type { EditorState } from "@/lib/editor/state-types"

/**
 * Wire shape for a saved draft. A draft is the user's *entire* working
 * state for a project, captured so they can resume editing later:
 *
 *  - `present` — the full EditorState: every canvas (with its screenshot
 *    base64 pixels), aspect, annotation tool, etc.
 *  - `ui` — non-history UI settings (preset tab, bulk-edit mode, active
 *    preset selection, preview cadence). These don't live inside
 *    EditorState but are needed for true resume-from-here.
 *
 * The legacy save flow only sent `state: EditorState` directly. The Zod
 * schema below ({@link draftStateSchema}) accepts both shapes; older
 * drafts still load via {@link unwrapDraftState}.
 */
export type DraftUiState = {
  presetTab?: "single" | "multi" | "triple" | "custom"
  activeLayoutPresetId?: string | null
  activeCustomPresetId?: string | null
  activeSinglePresetId?: string | null
  bulkEditMode?: boolean
  bulkViewportZoom?: number
  bulkScale?: number
  previewAutoScrollDelay?: number
  previewAnimation?: "slide" | "fade" | "zoom" | "flip"
}

export type DraftPayload = {
  schemaVersion: 1
  present: EditorState
  ui: DraftUiState
}

export const DRAFT_SCHEMA_VERSION = 1 as const

export const DRAFT_NAME_MAX_LENGTH = 80

/**
 * Draft state is stored as JSON in R2. Keep the cap comfortably below the
 * old 16 MB BSON ceiling and below what users should realistically wait on.
 */
export const MAX_DRAFT_BYTES = 15 * 1024 * 1024

// --- Zod schemas -----------------------------------------------------------

const presetTabSchema = z.enum(["single", "multi", "triple", "custom"])

const previewAnimationSchema = z.enum(["slide", "fade", "zoom", "flip"])

export const draftUiSchema = z
  .object({
    presetTab: presetTabSchema.optional(),
    activeLayoutPresetId: z.string().nullable().optional(),
    activeCustomPresetId: z.string().nullable().optional(),
    activeSinglePresetId: z.string().nullable().optional(),
    bulkEditMode: z.boolean().optional(),
    bulkViewportZoom: z.number().finite().optional(),
    bulkScale: z.number().finite().optional(),
    previewAutoScrollDelay: z.number().finite().optional(),
    previewAnimation: previewAnimationSchema.optional(),
  })
  .loose()

/**
 * The big nested EditorState carries dozens of inspector fields whose exact
 * shapes evolve frequently. We deliberately keep this validation shallow
 * (must be an object with a non-empty canvases array of objects) and trust
 * the normalisation pass inside `normalizeEditorState` on the client to
 * merge missing fields against the current defaults.
 */
const editorStateLikeSchema = z
  .object({
    canvases: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .loose()

const wrappedDraftSchema = z
  .object({
    schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
    present: editorStateLikeSchema,
    ui: draftUiSchema.optional(),
  })
  .loose()

/** Accepts both the wrapped shape and legacy raw-EditorState drafts. */
export const draftStateSchema = z.union([
  wrappedDraftSchema,
  editorStateLikeSchema,
])

export type ParsedDraftState = z.infer<typeof draftStateSchema>

/** Request body for `POST /api/drafts`. */
export const createDraftBodySchema = z.object({
  name: z.string().trim().min(1).max(DRAFT_NAME_MAX_LENGTH),
  state: draftStateSchema,
})

/** Request body for `PUT /api/drafts/[id]`. */
export const updateDraftBodySchema = z.object({
  name: z.string().trim().min(1).max(DRAFT_NAME_MAX_LENGTH).optional(),
  state: draftStateSchema,
})

// --- Helpers ---------------------------------------------------------------

function hasDraftCanvases(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as { canvases?: unknown }
  return Array.isArray(candidate.canvases) && candidate.canvases.length > 0
}

export function isDraftStateLike(value: unknown): value is ParsedDraftState {
  if (hasDraftCanvases(value)) return true
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as { present?: unknown; schemaVersion?: unknown }
  return (
    candidate.schemaVersion === DRAFT_SCHEMA_VERSION &&
    hasDraftCanvases(candidate.present)
  )
}

export function parseDraftSaveBody(
  value: unknown,
  { requireName }: { requireName: boolean }
):
  | { ok: true; name?: string; state: ParsedDraftState }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid body" }
  }

  const body = value as { name?: unknown; state?: unknown }
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : undefined

  if (requireName && !name) {
    return { ok: false, error: "Name is required" }
  }
  if (name && name.length > DRAFT_NAME_MAX_LENGTH) {
    return { ok: false, error: "Name is too long" }
  }
  if (!isDraftStateLike(body.state)) {
    return { ok: false, error: "Invalid draft state" }
  }

  return { ok: true, name, state: body.state }
}

export function isWrappedDraftState(value: unknown): value is DraftPayload {
  if (!value || typeof value !== "object") return false
  const candidate = value as { present?: unknown; schemaVersion?: unknown }
  return (
    typeof candidate.present === "object" &&
    candidate.present !== null &&
    !Array.isArray(candidate.present)
  )
}

/**
 * Pull EditorState out of whatever the server returned. Supports both the
 * current wrapped shape and legacy raw EditorState payloads.
 */
export function unwrapDraftState(value: unknown): {
  present: Partial<EditorState>
  ui: DraftUiState
} {
  if (isWrappedDraftState(value)) {
    return {
      present: value.present,
      ui: value.ui ?? {},
    }
  }
  return {
    present: (value as Partial<EditorState>) ?? {},
    ui: {},
  }
}

/** The number of canvases in a draft (used for the metadata row). */
export function countCanvasesInDraftState(value: unknown): number {
  const { present } = unwrapDraftState(value)
  return Array.isArray(present.canvases) ? present.canvases.length : 1
}
