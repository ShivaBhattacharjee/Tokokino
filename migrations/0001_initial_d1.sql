CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" INTEGER,
  "refreshTokenExpiresAt" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE INDEX IF NOT EXISTS "account_provider_account_idx"
  ON "account" ("providerId", "accountId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER,
  "updatedAt" INTEGER
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "drafts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "canvas_count" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "state_key" TEXT NOT NULL,
  "thumbnail_key" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "drafts_user_updated_idx"
  ON "drafts" ("user_id", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "custom_presets" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slot_count" INTEGER NOT NULL,
  "geometry" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "custom_presets_user_created_idx"
  ON "custom_presets" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "shares" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "object_key" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "image_hash" TEXT,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT,
  "user_email" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  "last_viewed_at" TEXT,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "unique_view_count" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "shares_user_created_idx"
  ON "shares" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "shares_user_image_hash_idx"
  ON "shares" ("user_id", "image_hash");

CREATE TABLE IF NOT EXISTS "share_views" (
  "share_id" TEXT NOT NULL,
  "ip_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "first_viewed_at" TEXT NOT NULL,
  "last_viewed_at" TEXT NOT NULL,
  "visit_count" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("share_id", "ip_hash"),
  FOREIGN KEY ("share_id") REFERENCES "shares" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "share_views_share_last_viewed_idx"
  ON "share_views" ("share_id", "last_viewed_at" DESC);
