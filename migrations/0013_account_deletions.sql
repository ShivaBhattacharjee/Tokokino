CREATE TABLE IF NOT EXISTS "account_deletions" (
  "user_id" TEXT PRIMARY KEY NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);
