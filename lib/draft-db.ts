import "server-only"

import type { Collection } from "mongodb"

import { getConnectedMongoClient } from "@/lib/mongo"

/**
 * MongoDB CRUD for saved drafts.
 *
 * The entire project state — every canvas, base64 screenshot, inspector
 * setting, layer, annotation — lives inline in the `state` field of each
 * doc. R2 is only used for the JPEG thumbnail referenced by `thumbnailKey`.
 *
 * BSON imposes a hard 16 MB per-document ceiling, so the route layer
 * rejects payloads above 15 MB to leave headroom for indexes + metadata.
 */
export type DraftRecord = {
  id: string
  userId: string
  name: string
  canvasCount: number
  byteSize: number
  state: unknown
  thumbnailKey: string | null
  createdAt: Date
  updatedAt: Date
}

let indexPromise: Promise<void> | null = null

async function getCollection(): Promise<Collection<DraftRecord>> {
  const client = await getConnectedMongoClient()
  return client.db().collection<DraftRecord>("drafts")
}

async function ensureIndexes(collection: Collection<DraftRecord>) {
  indexPromise ??= Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, updatedAt: -1 }),
  ]).then(() => undefined)
  await indexPromise
}

const LIST_PROJECTION = {
  // Skip `state` when listing to keep responses light — it can be a few MB.
  state: 0,
} as const

export async function listDrafts(userId: string) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection
    .find({ userId }, { projection: LIST_PROJECTION })
    .sort({ updatedAt: -1 })
    .toArray()
}

export async function getDraft({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.findOne({ id, userId })
}

export async function getDraftById(id: string) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.findOne({ id })
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
  const collection = await getCollection()
  await ensureIndexes(collection)
  const now = new Date()
  await collection.insertOne({
    id,
    userId,
    name,
    canvasCount,
    byteSize,
    state,
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
  const collection = await getCollection()
  await ensureIndexes(collection)
  const now = new Date()
  const update: Partial<DraftRecord> = {
    canvasCount,
    byteSize,
    state,
    updatedAt: now,
  }
  if (name !== undefined) update.name = name
  if (thumbnailKey !== undefined) update.thumbnailKey = thumbnailKey
  return collection.findOneAndUpdate(
    { id, userId },
    { $set: update },
    { returnDocument: "after" }
  )
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
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.findOneAndUpdate(
    { id, userId },
    { $set: { thumbnailKey, updatedAt: new Date() } },
    { returnDocument: "after" }
  )
}

export async function deleteDraft({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.findOneAndDelete({ id, userId })
}
