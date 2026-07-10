-- Distinguish still shares from animate (video/gif) shares.
ALTER TABLE "shares" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'style';
ALTER TABLE "shares" ADD COLUMN "content_type" TEXT NOT NULL DEFAULT 'image/png';

CREATE INDEX IF NOT EXISTS "shares_user_type_created_idx"
  ON "shares" ("user_id", "type", "created_at" DESC);
