CREATE TABLE "share_uploads" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "share_id" TEXT NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "r2_upload_id" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "poster_key" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "completed_at" TEXT
);

CREATE TABLE "share_upload_parts" (
  "upload_id" TEXT NOT NULL REFERENCES "share_uploads"("id") ON DELETE CASCADE,
  "part_number" INTEGER NOT NULL,
  "etag" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL,
  PRIMARY KEY ("upload_id", "part_number")
);

CREATE INDEX "share_uploads_user_expiry_idx"
  ON "share_uploads" ("user_id", "expires_at");
CREATE INDEX "share_uploads_expiry_idx"
  ON "share_uploads" ("expires_at");
