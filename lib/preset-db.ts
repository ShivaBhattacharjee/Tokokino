import "server-only"

import type { Collection } from "mongodb"

import { getConnectedMongoClient } from "@/lib/mongo"

/**
 * Stored snapshot for a custom preset. Carries full canvas styling (every
 * inspector field — background, backdrop, border, shadow, overlay, portrait,
 * etc.) along with geometry, but never the screenshot pixels themselves.
 * `canvasStyle` is intentionally typed loosely server-side; the client owns
 * its shape and uses defensive merging when re-applying.
 */
export type StoredPresetGeometry = {
  canvasTilt: { rx: number; ry: number; rz: number }
  canvasScale: number
  slots: Array<Record<string, unknown>>
  mainOffset?: { xPct: number; yPct: number }
  relativeSlotPositions?: boolean
  canvasStyle?: Record<string, unknown>
}

export type CustomPresetRecord = {
  id: string
  userId: string
  name: string
  slotCount: number
  geometry: StoredPresetGeometry
  createdAt: Date
  updatedAt: Date
}

let indexPromise: Promise<void> | null = null

async function getCollection(): Promise<Collection<CustomPresetRecord>> {
  const client = await getConnectedMongoClient()
  return client.db().collection<CustomPresetRecord>("customPresets")
}

async function ensureIndexes(collection: Collection<CustomPresetRecord>) {
  indexPromise ??= Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, createdAt: -1 }),
  ]).then(() => undefined)
  await indexPromise
}

export async function listCustomPresets(userId: string) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
}

export async function createCustomPreset({
  id,
  userId,
  name,
  slotCount,
  geometry,
}: {
  id: string
  userId: string
  name: string
  slotCount: number
  geometry: StoredPresetGeometry
}) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  const now = new Date()
  await collection.insertOne({
    id,
    userId,
    name,
    slotCount,
    geometry,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateCustomPreset({
  id,
  userId,
  name,
  slotCount,
  geometry,
}: {
  id: string
  userId: string
  name: string
  slotCount: number
  geometry: StoredPresetGeometry
}) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.updateOne(
    { id, userId },
    { $set: { name, slotCount, geometry, updatedAt: new Date() } }
  )
}

export async function deleteCustomPreset({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.deleteOne({ id, userId })
}

export async function getCustomPresetById(id: string) {
  const collection = await getCollection()
  await ensureIndexes(collection)
  return collection.findOne({ id })
}
