-- Distinguish style presets from animate (timeline) presets.
ALTER TABLE "custom_presets" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'style';

CREATE INDEX IF NOT EXISTS "custom_presets_user_type_created_idx"
  ON "custom_presets" ("user_id", "type", "created_at" DESC);
