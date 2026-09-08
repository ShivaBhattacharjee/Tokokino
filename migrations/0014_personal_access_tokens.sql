CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE,
  "prefix" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "last_used_at" TEXT,
  "expires_at" TEXT,
  FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "personal_access_tokens_user_created_idx"
  ON "personal_access_tokens" ("user_id", "created_at" DESC);
