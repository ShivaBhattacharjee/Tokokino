CREATE TABLE "draft_media" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "draft_id" TEXT,
  "object_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX "idx_draft_media_user_draft"
  ON "draft_media" ("user_id", "draft_id");
