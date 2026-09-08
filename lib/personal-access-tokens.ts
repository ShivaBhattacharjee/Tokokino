import "server-only"

import { createHash } from "node:crypto"

import { and, desc, eq, gt, isNull, or } from "drizzle-orm"
import { z } from "zod/v4"

import { getD1Database, getDb, toD1Date } from "@/lib/d1"
import { personalAccessTokens } from "@/lib/db/schema"

/** Prefix distinguishing personal access tokens from session tokens. */
export const PAT_PREFIX = "tk_"

/** Cap on active tokens per user, to bound the verification scan. */
export const MAX_TOKENS_PER_USER = 20

export const patNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Name must be 60 characters or fewer")

export type PersonalAccessTokenSummary = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

function rowToSummary(row: typeof personalAccessTokens.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  }
}

/**
 * Generate a new token. Uses the Web Crypto API so this also runs on the
 * Workers runtime, where `node:crypto` random helpers may be unavailable.
 */
export function generatePersonalAccessToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `${PAT_PREFIX}${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`
}

export function hashPersonalAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function isPersonalAccessTokenFormat(value: string): boolean {
  return (
    value.startsWith(PAT_PREFIX) &&
    value.length >= PAT_PREFIX.length + 20 &&
    /^[A-Za-z0-9_-]+$/.test(value.slice(PAT_PREFIX.length))
  )
}

/** Non-secret identifier shown in the UI, e.g. `tk_ab12…wxyz`. */
export function tokenPrefixDisplay(token: string): string {
  const secret = token.slice(PAT_PREFIX.length)
  return `${PAT_PREFIX}${secret.slice(0, 4)}…${secret.slice(-4)}`
}

export function extractBearerToken(headers: Headers): string | null {
  const header = headers.get("authorization")
  if (!header) return null
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim())
  return match?.[1] ? match[1].trim() : null
}

export function isTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() <= Date.now()
}

export async function listPersonalAccessTokens(
  userId: string
): Promise<PersonalAccessTokenSummary[]> {
  const rows = await getDb()
    .select()
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.userId, userId))
    .orderBy(desc(personalAccessTokens.createdAt))
  return rows.map(rowToSummary)
}

export async function countPersonalAccessTokens(
  userId: string
): Promise<number> {
  const rows = await getDb()
    .select({ id: personalAccessTokens.id })
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.userId, userId))
  return rows.length
}

/**
 * Tokens counting toward `MAX_TOKENS_PER_USER`. Expired tokens can never
 * authenticate, so they must not block the creation of usable ones.
 */
export async function countActivePersonalAccessTokens(
  userId: string
): Promise<number> {
  const now = toD1Date(new Date())
  const rows = await getDb()
    .select({ id: personalAccessTokens.id })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.userId, userId),
        or(
          isNull(personalAccessTokens.expiresAt),
          gt(personalAccessTokens.expiresAt, now)
        )
      )
    )
  return rows.length
}

/** Minimum age of `last_used_at` before a PAT request refreshes it. */
export const PAT_LAST_USED_UPDATE_INTERVAL_MS = 60 * 60 * 1000

/**
 * Whether a successful authentication should rewrite `last_used_at`.
 * Throttled so bursty scripts and CI cost one metadata write per token per
 * hour instead of one per request.
 */
export function shouldRefreshLastUsedAt(
  lastUsedAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!lastUsedAt) return true
  const seen = new Date(lastUsedAt).getTime()
  if (!Number.isFinite(seen)) return true
  return now - seen >= PAT_LAST_USED_UPDATE_INTERVAL_MS
}

export async function createPersonalAccessTokenRecord({
  id,
  userId,
  name,
  tokenHash,
  prefix,
  expiresAt,
}: {
  id: string
  userId: string
  name: string
  tokenHash: string
  prefix: string
  expiresAt: string | null
}) {
  const createdAt = toD1Date(new Date())
  await getDb().insert(personalAccessTokens).values({
    id,
    userId,
    name,
    tokenHash,
    prefix,
    createdAt,
    lastUsedAt: null,
    expiresAt,
  })
  return { id, name, prefix, createdAt, lastUsedAt: null, expiresAt }
}

export async function deletePersonalAccessToken(
  id: string,
  userId: string
): Promise<boolean> {
  const existing = await getDb()
    .select({ id: personalAccessTokens.id })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.id, id),
        eq(personalAccessTokens.userId, userId)
      )
    )
    .limit(1)
  if (existing.length === 0) return false
  await getDb()
    .delete(personalAccessTokens)
    .where(eq(personalAccessTokens.id, id))
  return true
}

export type PatOwner = {
  tokenId: string
  user: { id: string; name: string | null; email: string | null }
}

/**
 * Resolve a plaintext token to its owner. Returns null for unknown, expired,
 * or orphaned tokens. Refreshes `last_used_at` as a side effect.
 */
export async function verifyPersonalAccessToken(
  token: string
): Promise<PatOwner | null> {
  if (!isPersonalAccessTokenFormat(token)) return null
  const tokenHash = hashPersonalAccessToken(token)
  const rows = await getDb()
    .select()
    .from(personalAccessTokens)
    .where(eq(personalAccessTokens.tokenHash, tokenHash))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (isTokenExpired(row.expiresAt)) return null

  const userRow = await getD1Database()
    .prepare('SELECT id, name, email FROM "user" WHERE id = ?')
    .bind(row.userId)
    .first<{ id: string; name: string | null; email: string | null }>()
  if (!userRow) return null

  if (shouldRefreshLastUsedAt(row.lastUsedAt)) {
    await getDb()
      .update(personalAccessTokens)
      .set({ lastUsedAt: toD1Date(new Date()) })
      .where(eq(personalAccessTokens.id, row.id))
      .catch(() => {})
  }

  return {
    tokenId: row.id,
    user: { id: userRow.id, name: userRow.name, email: userRow.email },
  }
}
