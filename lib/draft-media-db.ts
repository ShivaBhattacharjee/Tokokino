import "server-only"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { draftMedia } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"

export type DraftMedia = {
  id: string
  userId: string
  draftId: string | null
  objectKey: string
  contentType: string
  sizeBytes: number
  createdAt: Date
  updatedAt: Date
}

function toDraftMedia(row: typeof draftMedia.$inferSelect): DraftMedia {
  return {
    ...row,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
  }
}

export async function createDraftMedia(input: {
  id: string
  userId: string
  objectKey: string
  contentType: string
  sizeBytes: number
}) {
  const now = toD1Date(new Date())
  await getDb()
    .insert(draftMedia)
    .values({ ...input, draftId: null, createdAt: now, updatedAt: now })
}

export async function getDraftMedia(id: string, userId: string) {
  const row = await getDb()
    .select()
    .from(draftMedia)
    .where(and(eq(draftMedia.id, id), eq(draftMedia.userId, userId)))
    .get()
  return row ? toDraftMedia(row) : null
}

export async function getDraftMediaForDraft(draftId: string, userId: string) {
  const rows = await getDb()
    .select()
    .from(draftMedia)
    .where(and(eq(draftMedia.draftId, draftId), eq(draftMedia.userId, userId)))
    .all()
  return rows.map(toDraftMedia)
}

export async function getDraftMediaForSave(
  ids: string[],
  userId: string,
  draftId?: string
) {
  if (ids.length === 0) return []
  const rows = await getDb()
    .select()
    .from(draftMedia)
    .where(and(eq(draftMedia.userId, userId), inArray(draftMedia.id, ids)))
    .all()
  if (
    rows.length !== ids.length ||
    rows.some((row) => row.draftId && row.draftId !== draftId)
  )
    return null
  return rows.map(toDraftMedia)
}

export async function getUnattachedDraftMediaSize(userId: string) {
  const rows = await getDb()
    .select({ sizeBytes: draftMedia.sizeBytes })
    .from(draftMedia)
    .where(and(eq(draftMedia.userId, userId), isNull(draftMedia.draftId)))
    .all()
  return rows.reduce((total, row) => total + row.sizeBytes, 0)
}

export async function attachDraftMedia(
  ids: string[],
  userId: string,
  draftId: string
) {
  if (ids.length === 0) return
  await getDb()
    .update(draftMedia)
    .set({ draftId, updatedAt: toD1Date(new Date()) })
    .where(and(eq(draftMedia.userId, userId), inArray(draftMedia.id, ids)))
}

export async function deleteDraftMedia(ids: string[], userId: string) {
  if (ids.length === 0) return
  await getDb()
    .delete(draftMedia)
    .where(and(eq(draftMedia.userId, userId), inArray(draftMedia.id, ids)))
}
