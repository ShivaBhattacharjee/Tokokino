-- Distinguish present (style) projects from animate projects in the list UI.
ALTER TABLE "drafts" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'style';

CREATE INDEX IF NOT EXISTS "drafts_user_type_updated_idx"
  ON "drafts" ("user_id", "type", "updated_at" DESC);
