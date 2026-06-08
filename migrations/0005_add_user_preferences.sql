CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "export_filename_format" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
