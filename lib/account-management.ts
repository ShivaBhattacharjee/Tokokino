import "server-only"

import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"

import {
  clearAccountDeletion,
  getAccountDeletionQueue,
  markAccountDeletion,
} from "@/lib/account-deletion"
import { draftMedia, drafts, shares, shareUploads } from "@/lib/db/schema"
import { getD1Database, getDb } from "@/lib/d1"
import { requireR2Config } from "@/lib/env"
import { getR2Client } from "@/lib/r2-client"
import { abortShareMultipartUpload } from "@/lib/share-storage"

type AccountCleanup = {
  objectKeys: string[]
  uploads: Array<{ objectKey: string; r2UploadId: string }>
}

function uniqueKeys(keys: Array<string | null>) {
  return [...new Set(keys.filter((key): key is string => Boolean(key)))]
}

async function removeR2Objects(cleanup: AccountCleanup) {
  const { bucket } = requireR2Config()
  const aborts = await Promise.allSettled(
    cleanup.uploads.map((upload) => abortShareMultipartUpload(upload))
  )
  const deletions = await Promise.allSettled(
    cleanup.objectKeys.map((key) =>
      getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    )
  )

  // An already-completed upload cannot be aborted, but its object is still
  // deleted above. Keeping the outbox for only object deletion failures avoids
  // a permanently stale retry record in that normal race.
  return (
    deletions.every((result) => result.status === "fulfilled") &&
    aborts.every(
      (result) =>
        result.status === "fulfilled" || result.reason?.name === "NoSuchUpload"
    )
  )
}

async function clearCleanup(id: string) {
  await getD1Database()
    .prepare("DELETE FROM account_deletion_cleanups WHERE id = ?")
    .bind(id)
    .run()
}

/**
 * Removes a user's database records in one D1 batch and stores an outbox row
 * before attempting R2 cleanup. D1 and R2 do not support a shared transaction;
 * the outbox makes failed object deletion durable and idempotent.
 */
export async function deleteManagedAccount(userId: string) {
  const db = getDb()
  const [userDrafts, media, userShares, uploads] = await Promise.all([
    db
      .select({ stateKey: drafts.stateKey, thumbnailKey: drafts.thumbnailKey })
      .from(drafts)
      .where(eq(drafts.userId, userId)),
    db
      .select({ objectKey: draftMedia.objectKey })
      .from(draftMedia)
      .where(eq(draftMedia.userId, userId)),
    db
      .select({ objectKey: shares.objectKey, posterKey: shares.posterKey })
      .from(shares)
      .where(eq(shares.userId, userId)),
    db
      .select({
        objectKey: shareUploads.objectKey,
        r2UploadId: shareUploads.r2UploadId,
      })
      .from(shareUploads)
      .where(eq(shareUploads.userId, userId)),
  ])

  const cleanup: AccountCleanup = {
    objectKeys: uniqueKeys([
      ...userDrafts.flatMap((draft) => [draft.stateKey, draft.thumbnailKey]),
      ...media.map((item) => item.objectKey),
      ...userShares.flatMap((share) => [share.objectKey, share.posterKey]),
      ...uploads.map((upload) => upload.objectKey),
    ]),
    uploads,
  }
  const cleanupId = crypto.randomUUID()
  const d1 = getD1Database()
  const now = new Date().toISOString()

  await d1.batch([
    d1
      .prepare(
        "INSERT INTO account_deletion_cleanups (id, object_keys, uploads, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(
        cleanupId,
        JSON.stringify(cleanup.objectKeys),
        JSON.stringify(cleanup.uploads),
        now
      ),
    d1
      .prepare(
        "DELETE FROM session_locations WHERE session_id IN (SELECT id FROM session WHERE userId = ?)"
      )
      .bind(userId),
    d1.prepare("DELETE FROM user_preferences WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM custom_presets WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM draft_media WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM drafts WHERE user_id = ?").bind(userId),
    d1
      .prepare(
        "DELETE FROM share_upload_parts WHERE upload_id IN (SELECT id FROM share_uploads WHERE user_id = ?)"
      )
      .bind(userId),
    d1.prepare("DELETE FROM share_uploads WHERE user_id = ?").bind(userId),
    d1
      .prepare(
        "DELETE FROM share_views WHERE share_id IN (SELECT id FROM shares WHERE user_id = ?)"
      )
      .bind(userId),
    d1.prepare("DELETE FROM shares WHERE user_id = ?").bind(userId),
    d1.prepare("DELETE FROM user WHERE id = ?").bind(userId),
  ])

  if (await removeR2Objects(cleanup)) await clearCleanup(cleanupId)
}

/**
 * Flags the account for deletion and hands the heavy work to the Cloudflare
 * Queue. When the queue binding is unavailable (local `next dev`), the deletion
 * runs inline so the flow still completes end to end.
 */
export async function requestAccountDeletion(
  userId: string
): Promise<{ queued: boolean }> {
  await markAccountDeletion(userId, "pending")

  const queue = getAccountDeletionQueue()
  if (queue) {
    try {
      await queue.send({ userId, requestedAt: new Date().toISOString() })
      return { queued: true }
    } catch (error) {
      // A failed send must not leave the account flagged with no job to run it
      // (the flag blocks re-login). Fall back to deleting inline.
      console.error("Account deletion enqueue failed; deleting inline", error)
    }
  }

  await processAccountDeletion(userId)
  return { queued: false }
}

/**
 * Runs the actual deletion. Invoked by the queue consumer through the internal
 * route so it executes inside the OpenNext request context (where the D1 and R2
 * bindings resolve).
 */
export async function processAccountDeletion(userId: string) {
  await markAccountDeletion(userId, "processing")
  await deleteManagedAccount(userId)
  await clearAccountDeletion(userId)
}

/** Retries durable R2 cleanup from previous account-deletion requests. */
export async function retryPendingAccountCleanups() {
  const rows = await getD1Database()
    .prepare(
      "SELECT id, object_keys, uploads FROM account_deletion_cleanups ORDER BY created_at ASC LIMIT 10"
    )
    .all<{ id: string; object_keys: string; uploads: string }>()

  await Promise.all(
    (rows.results ?? []).map(async (row) => {
      try {
        const cleanup: AccountCleanup = {
          objectKeys: JSON.parse(row.object_keys) as string[],
          uploads: JSON.parse(row.uploads) as AccountCleanup["uploads"],
        }
        if (await removeR2Objects(cleanup)) await clearCleanup(row.id)
      } catch (error) {
        console.error("Could not retry account storage cleanup", error)
      }
    })
  )
}
