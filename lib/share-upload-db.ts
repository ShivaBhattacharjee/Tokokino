import "server-only"

import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm"

import {
  shares,
  shareUploadParts,
  shareUploads,
  type ShareUploadStatus,
} from "@/lib/db/schema"
import { fromD1Date, getD1Database, getDb, toD1Date } from "@/lib/d1"
import { MAX_USER_SHARE_STORAGE_BYTES } from "@/lib/share-db"

export const SHARE_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

export type ShareUpload = {
  id: string
  shareId: string
  userId: string
  objectKey: string
  r2UploadId: string
  contentType: string
  sizeBytes: number
  status: ShareUploadStatus
  posterKey: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  completedAt: Date | null
}

export type ShareUploadPart = {
  uploadId: string
  partNumber: number
  etag: string
  sizeBytes: number
  createdAt: Date
}

function toUpload(row: typeof shareUploads.$inferSelect): ShareUpload {
  return {
    ...row,
    status: row.status,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
    expiresAt: fromD1Date(row.expiresAt) ?? new Date(row.expiresAt),
    completedAt: fromD1Date(row.completedAt),
  }
}

function toPart(row: typeof shareUploadParts.$inferSelect): ShareUploadPart {
  return {
    ...row,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
  }
}

export async function getShareUploadForUser(id: string, userId: string) {
  const row = await getDb()
    .select()
    .from(shareUploads)
    .where(and(eq(shareUploads.id, id), eq(shareUploads.userId, userId)))
    .get()
  return row ? toUpload(row) : null
}

export async function getShareUploadParts(uploadId: string) {
  const rows = await getDb()
    .select()
    .from(shareUploadParts)
    .where(eq(shareUploadParts.uploadId, uploadId))
    .orderBy(asc(shareUploadParts.partNumber))
    .all()
  return rows.map(toPart)
}

export async function getUserShareUploadReservation(userId: string) {
  const now = toD1Date(new Date())
  const row = await getDb()
    .select({
      total: sql<number>`COALESCE(SUM(${shareUploads.sizeBytes}), 0)`,
    })
    .from(shareUploads)
    .where(
      and(
        eq(shareUploads.userId, userId),
        inArray(shareUploads.status, ["active", "finalizing"]),
        gt(shareUploads.expiresAt, now)
      )
    )
    .get()
  return Number(row?.total ?? 0)
}

export async function canReserveShareUpload(userId: string, sizeBytes: number) {
  const [completed, reserved] = await Promise.all([
    getDb()
      .select({ total: sql<number>`COALESCE(SUM(${shares.sizeBytes}), 0)` })
      .from(shares)
      .where(eq(shares.userId, userId))
      .get(),
    getUserShareUploadReservation(userId),
  ])
  const used = Number(completed?.total ?? 0) + reserved
  return {
    allowed: used + sizeBytes <= MAX_USER_SHARE_STORAGE_BYTES,
    used,
    limit: MAX_USER_SHARE_STORAGE_BYTES,
  }
}

export async function createShareUpload(input: {
  id: string
  shareId: string
  userId: string
  objectKey: string
  r2UploadId: string
  contentType: string
  sizeBytes: number
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SHARE_UPLOAD_TTL_MS)
  const nowValue = toD1Date(now)
  const expiresValue = toD1Date(expiresAt)
  // The quota check and reservation must be one D1 statement. A read followed
  // by an insert lets simultaneous browser tabs both reserve the final bytes.
  const result = await getD1Database()
    .prepare(
      `INSERT INTO share_uploads (
        id, share_id, user_id, object_key, r2_upload_id, content_type,
        size_bytes, status, poster_key, created_at, updated_at, expires_at,
        completed_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, NULL
      WHERE
        COALESCE((SELECT SUM(size_bytes) FROM shares WHERE user_id = ?), 0)
        + COALESCE((
          SELECT SUM(size_bytes) FROM share_uploads
          WHERE user_id = ?
            AND status IN ('active', 'finalizing')
            AND expires_at > ?
        ), 0)
        + ? <= ?`
    )
    .bind(
      input.id,
      input.shareId,
      input.userId,
      input.objectKey,
      input.r2UploadId,
      input.contentType,
      input.sizeBytes,
      nowValue,
      nowValue,
      expiresValue,
      input.userId,
      input.userId,
      nowValue,
      input.sizeBytes,
      MAX_USER_SHARE_STORAGE_BYTES
    )
    .run()
  if (result.meta.changes !== 1) return null
  return getShareUploadForUser(input.id, input.userId)
}

export async function recordShareUploadPart(input: {
  uploadId: string
  partNumber: number
  etag: string
  sizeBytes: number
}) {
  const now = toD1Date(new Date())
  await getDb()
    .insert(shareUploadParts)
    .values({ ...input, createdAt: now })
    .onConflictDoUpdate({
      target: [shareUploadParts.uploadId, shareUploadParts.partNumber],
      set: { etag: input.etag, sizeBytes: input.sizeBytes, createdAt: now },
    })
}

export async function markShareUploadFinalizing(id: string, userId: string) {
  const now = toD1Date(new Date())
  await getDb()
    .update(shareUploads)
    .set({ status: "finalizing", updatedAt: now })
    .where(
      and(
        eq(shareUploads.id, id),
        eq(shareUploads.userId, userId),
        inArray(shareUploads.status, ["active", "finalizing"])
      )
    )
  return getShareUploadForUser(id, userId)
}

export async function markShareUploadComplete(id: string, userId: string) {
  const now = toD1Date(new Date())
  await getDb()
    .update(shareUploads)
    .set({
      status: "complete",
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(shareUploads.id, id), eq(shareUploads.userId, userId)))
  return getShareUploadForUser(id, userId)
}

export async function setShareUploadCancelled(id: string, userId?: string) {
  const now = toD1Date(new Date())
  const where = userId
    ? and(eq(shareUploads.id, id), eq(shareUploads.userId, userId))
    : eq(shareUploads.id, id)
  await getDb()
    .update(shareUploads)
    .set({ status: "cancelled", updatedAt: now })
    .where(where)
}

export async function getExpiredShareUploads() {
  const now = toD1Date(new Date())
  const rows = await getDb()
    .select()
    .from(shareUploads)
    .where(
      and(
        inArray(shareUploads.status, ["active", "finalizing"]),
        lt(shareUploads.expiresAt, now)
      )
    )
    .all()
  return rows.map(toUpload)
}

export async function touchShareUpload(id: string, userId: string) {
  await getDb()
    .update(shareUploads)
    .set({ updatedAt: toD1Date(new Date()) })
    .where(and(eq(shareUploads.id, id), eq(shareUploads.userId, userId)))
}

export async function getConfirmedShareUploadBytes(uploadId: string) {
  const row = await getDb()
    .select({
      total: sql<number>`COALESCE(SUM(${shareUploadParts.sizeBytes}), 0)`,
    })
    .from(shareUploadParts)
    .where(eq(shareUploadParts.uploadId, uploadId))
    .get()
  return Number(row?.total ?? 0)
}

export function isShareUploadExpired(upload: ShareUpload) {
  return (
    upload.status !== "complete" && upload.expiresAt.getTime() <= Date.now()
  )
}
