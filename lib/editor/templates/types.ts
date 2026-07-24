import type { DraftPayload } from "@/lib/schemas/draft"
import type { TemplateCategory, TemplateMeta } from "./catalog"

export type { TemplateCategory, TemplateMeta } from "./catalog"

export type TemplateTab = "all" | TemplateCategory

/**
 * A curated, repo-baked starting composition. Unlike the per-user custom
 * presets stored in D1, templates ship with the app: their display metadata
 * lives in `./catalog` (the single source used by both the editor and the
 * landing showcase) and their full editor state lives inline in the per-slug
 * module (see `lib/editor/templates/<slug>.ts`), merged onto the metadata.
 * Applying one starts a brand-new, unsaved project via `loadTemplateState`.
 */
export type Template = TemplateMeta & {
  /** Full composition, same wire shape as a saved draft. */
  state: DraftPayload
}
