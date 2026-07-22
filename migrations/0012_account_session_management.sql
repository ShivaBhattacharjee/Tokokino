CREATE TABLE IF NOT EXISTS "session_locations" (
  "session_id" TEXT PRIMARY KEY NOT NULL,
  "location" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account_deletion_cleanups" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "object_keys" TEXT NOT NULL,
  "uploads" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);
