import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { getD1Database } from "@/lib/d1"

/** Cloudflare Queue binding that carries heavy account-deletion jobs. */
export const ACCOUNT_DELETION_QUEUE = "ACCOUNT_DELETION_QUEUE"

export type AccountDeletionMessage = { userId: string; requestedAt: string }
export type AccountDeletionStatus = "pending" | "processing"

type DeletionQueue = { send: (body: AccountDeletionMessage) => Promise<void> }

/**
 * The queue binding only exists in the Workers runtime (preview/deploy and
 * `wrangler dev`). Under plain `next dev` it is absent, so callers fall back to
 * running the deletion inline.
 */
export function getAccountDeletionQueue(): DeletionQueue | null {
  try {
    const binding = (
      getCloudflareContext().env as unknown as Record<string, unknown>
    )[ACCOUNT_DELETION_QUEUE]
    if (binding && typeof (binding as DeletionQueue).send === "function") {
      return binding as DeletionQueue
    }
  } catch {
    // No Cloudflare context available (local `next dev` / `next build`).
  }
  return null
}

/**
 * Records or advances the deletion flag. `requested_at` is only written on the
 * first insert so the original request time survives a status transition.
 */
export async function markAccountDeletion(
  userId: string,
  status: AccountDeletionStatus
) {
  const now = new Date().toISOString()
  await getD1Database()
    .prepare(
      "INSERT INTO account_deletions (user_id, status, requested_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at"
    )
    .bind(userId, status, now, now)
    .run()
}

/** True while an account is flagged for deletion — used to block re-login. */
export async function isAccountDeletionPending(
  userId: string
): Promise<boolean> {
  const row = await getD1Database()
    .prepare("SELECT 1 AS present FROM account_deletions WHERE user_id = ?")
    .bind(userId)
    .first<{ present: number }>()
  return Boolean(row)
}

export async function clearAccountDeletion(userId: string) {
  await getD1Database()
    .prepare("DELETE FROM account_deletions WHERE user_id = ?")
    .bind(userId)
    .run()
}

/**
 * User ids whose deletion flag has not advanced for a while — a job that was
 * dropped, dead-lettered, or hit a transient failure. `updated_at` bumps on
 * every status transition, so an actively-processing row is never returned and
 * a repeatedly-failing one backs off ~`olderThanMinutes` between retries.
 */
export async function listStalePendingDeletions(options?: {
  olderThanMinutes?: number
  limit?: number
}): Promise<string[]> {
  const olderThanMinutes = options?.olderThanMinutes ?? 15
  const limit = options?.limit ?? 25
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString()
  const rows = await getD1Database()
    .prepare(
      "SELECT user_id FROM account_deletions WHERE updated_at <= ? ORDER BY updated_at ASC LIMIT ?"
    )
    .bind(cutoff, limit)
    .all<{ user_id: string }>()
  return (rows.results ?? []).map((row) => row.user_id)
}
