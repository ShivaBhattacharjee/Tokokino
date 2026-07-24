import { captureCanvasThumbnail } from "@/lib/editor/export"
import type {
  Background,
  CanvasState,
  EditorState,
} from "@/lib/editor/state-types"
import { useEditorStore } from "@/lib/editor/store"
import { DRAFT_SCHEMA_VERSION, type DraftPayload } from "@/lib/schemas/draft"

import type { TemplateCategory } from "./types"

export type CapturedTemplate = {
  category: TemplateCategory
  slug: string
  /** Ready to paste into `lib/editor/templates/<slug>.ts`. */
  json: string
  /** Permanent R2 poster URL, or null if the upload was skipped/failed. */
  thumbnailUrl: string | null
}

function isBulky(value: string | null | undefined): boolean {
  return Boolean(
    value && (value.startsWith("data:") || value.startsWith("blob:"))
  )
}

/** Keep solids/gradients and remote URLs; drop bulky inline image payloads. */
function compactBackground(bg: Background): Background {
  if (bg.type !== "image" || !isBulky(bg.value)) return bg
  return { ...bg, value: bg.sourceUrl || bg.thumbUrl || "" }
}

/**
 * A template stores composition, not media: its screenshot only exists to make
 * the poster (captured separately from the live DOM). So strip every media
 * field before serializing — that keeps the copied JSON small (no screenshot
 * base64) and matches what loadTemplateState applies.
 */
function sanitizeCanvasForTemplate(canvas: CanvasState): CanvasState {
  return {
    ...canvas,
    screenshot: null,
    originalScreenshot: null,
    lastCropRegion: null,
    videoClips: null,
    tweet: null,
    fullPageCapture: { scrollPosition: 0 },
    background: compactBackground(canvas.background),
    screenshotSlots: canvas.screenshotSlots.map((slot) => ({
      ...slot,
      src: null,
      originalSrc: null,
    })),
  }
}

function sanitizePresentForTemplate(present: EditorState): EditorState {
  return {
    ...present,
    canvases: present.canvases.map(sanitizeCanvasForTemplate),
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "template"
  )
}

async function publishPoster(slug: string): Promise<string | null> {
  const state = useEditorStore.getState()
  const thumb = await captureCanvasThumbnail(state.present.activeCanvasId, 800)
  if (!thumb) return null

  const res = await fetch(
    `/api/templates/thumb?slug=${encodeURIComponent(slug)}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": thumb.type || "image/jpeg" },
      body: thumb,
    }
  )
  const data = (await res.json().catch(() => null)) as {
    url?: string
    error?: string
  } | null
  if (!res.ok || !data?.url) {
    throw new Error(data?.error ?? "Could not publish poster")
  }
  return data.url
}

/**
 * Dev-only: snapshot the current editor state into a template payload, copy the
 * JSON to the clipboard, and publish the active canvas as a poster to R2 under
 * `templates/<slug>.jpg`. The developer names the slug (defaults to the current
 * project name); the maintainer drops the JSON into the catalogue and points
 * `thumbnail` at the returned URL. Screenshots are inlined back to data URLs so
 * the payload is fully self-contained (no live server media references).
 */
export async function captureCurrentAsTemplate(
  slugInput?: string
): Promise<CapturedTemplate> {
  const state = useEditorStore.getState()
  const present = sanitizePresentForTemplate(state.present)

  const payload: DraftPayload = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    present,
    ui: {
      presetTab: state.presetTab,
      activeLayoutPresetId: state.activeLayoutPresetId,
      activeCustomPresetId: state.activeCustomPresetId,
      activeSinglePresetId: state.activeSinglePresetId,
      bulkEditMode: state.bulkEditMode,
      bulkViewportZoom: state.bulkViewportZoom,
      bulkScale: state.bulkScale,
      previewAutoScrollDelay: state.previewAutoScrollDelay,
      previewAnimation: state.previewAnimation,
      isAnimateMode: state.isAnimateMode,
    },
  }

  const category: TemplateCategory = state.isAnimateMode ? "animation" : "image"
  const slug = slugify(slugInput || state.currentDraft?.name || "template")
  const json = JSON.stringify(payload, null, 2)

  try {
    await navigator.clipboard.writeText(json)
  } catch {
    // Clipboard can be blocked (focus / permissions); the caller still gets the
    // JSON string to surface some other way.
  }

  let thumbnailUrl: string | null = null
  try {
    thumbnailUrl = await publishPoster(slug)
  } catch (err) {
    console.warn("Could not publish template poster", err)
  }

  return { category, slug, json, thumbnailUrl }
}
