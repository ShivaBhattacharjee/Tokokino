import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { drafts } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"
import { getDraftState, uploadDraftState } from "@/lib/draft-storage"

/**
 * D1 metadata for saved drafts. Full editor state lives in R2 at `stateKey`
 * because screenshot-heavy drafts can be multiple MB.
 */
export type DraftRecord = {
  id: string
  userId: string
  name: string
  canvasCount: number
  byteSize: number
  state: unknown
  stateKey: string
  thumbnailKey: string | null
  createdAt: Date
  updatedAt: Date
}

type DraftRow = {
  id: string
  userId: string
  name: string
  canvasCount: number
  byteSize: number
  stateKey: string
  thumbnailKey: string | null
  createdAt: string
  updatedAt: string
}

async function readDraftState(row: DraftRow) {
  const object = await getDraftState({
    userId: row.userId,
    id: row.id,
    stateKey: row.stateKey,
  })
  const text = await object.Body?.transformToString()
  if (!text) throw new Error("Draft state not found")
  return JSON.parse(text) as unknown
}

function rowToDraft(row: DraftRow, state: unknown): DraftRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    canvasCount: row.canvasCount,
    byteSize: row.byteSize,
    state,
    stateKey: row.stateKey,
    thumbnailKey: row.thumbnailKey,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
  }
}

function rowToDraftMetadata(row: DraftRow): DraftRecord {
  return rowToDraft(row, null)
}

export async function listDrafts(userId: string) {
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(eq(drafts.userId, userId))
    .orderBy(desc(drafts.updatedAt))

  return rows.map(rowToDraftMetadata)
}

export async function getDraft({ id, userId }: { id: string; userId: string }) {
  const row = await getDb()
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))
    .get()

  if (!row) return null
  return rowToDraft(row, await readDraftState(row))
}

export async function getDraftMetadata({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const row = await getDb()
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))
    .get()

  return row ? rowToDraftMetadata(row) : null
}

export async function createDraft({
  id,
  userId,
  name,
  canvasCount,
  byteSize,
  state,
  thumbnailKey,
}: {
  id: string
  userId: string
  name: string
  canvasCount: number
  byteSize: number
  state: unknown
  thumbnailKey: string | null
}) {
  const stateBytes = new TextEncoder().encode(JSON.stringify(state))
  const stateKey = await uploadDraftState({ userId, id, body: stateBytes })
  const now = toD1Date(new Date())

  await getDb().insert(drafts).values({
    id,
    userId,
    name,
    canvasCount,
    byteSize,
    stateKey,
    thumbnailKey,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateDraft({
  id,
  userId,
  name,
  canvasCount,
  byteSize,
  state,
  thumbnailKey,
}: {
  id: string
  userId: string
  name?: string
  canvasCount: number
  byteSize: number
  state: unknown
  thumbnailKey?: string | null
}) {
  const existing = await getDraftMetadata({ id, userId })
  if (!existing) return null

  const stateBytes = new TextEncoder().encode(JSON.stringify(state))
  const stateKey = await uploadDraftState({ userId, id, body: stateBytes })
  const nextName = name ?? existing.name
  const nextThumbnailKey =
    thumbnailKey === undefined ? existing.thumbnailKey : thumbnailKey
  const now = toD1Date(new Date())

  await getDb()
    .update(drafts)
    .set({
      name: nextName,
      canvasCount,
      byteSize,
      stateKey,
      thumbnailKey: nextThumbnailKey,
      updatedAt: now,
    })
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))

  return getDraftMetadata({ id, userId })
}

export async function setDraftThumbnail({
  id,
  userId,
  thumbnailKey,
}: {
  id: string
  userId: string
  thumbnailKey: string | null
}) {
  await getDb()
    .update(drafts)
    .set({ thumbnailKey, updatedAt: toD1Date(new Date()) })
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))

  return getDraftMetadata({ id, userId })
}

export async function deleteDraft({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const existing = await getDraftMetadata({ id, userId })
  if (!existing) return null

  await getDb()
    .delete(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))

  return existing
}
