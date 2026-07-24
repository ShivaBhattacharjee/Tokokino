import type { DraftPayload } from "@/lib/schemas/draft"

/**
 * "image"     — a static screenshot composition (no timeline).
 * "animation" — an animate-mode composition with timeline clips; its card
 *                plays a recorded preview clip on hover.
 */
export type TemplateCategory = "image" | "animation"

export type TemplateTab = "all" | TemplateCategory

/**
 * A curated, repo-baked starting composition. Unlike the per-user custom
 * presets stored in D1, templates ship with the app: their full editor state
 * lives inline (see `lib/editor/templates/<slug>.ts`) and applying one starts a
 * brand-new, unsaved project via `loadTemplateState`.
 */
export type Template = {
  /** Stable kebab-case slug; also the asset basename on R2 (templates/<slug>.*). */
  id: string
  /** Display label, e.g. "Browser, Light". */
  name: string
  category: TemplateCategory
  /** Poster image on R2, e.g. "https://assets.tokokino.com/templates/<slug>.jpg". */
  thumbnail: string
  /** Preview clip (R2) that plays on hover — animation templates only. */
  preview?: string
  /** Full composition, same wire shape as a saved draft. */
  state: DraftPayload
}
