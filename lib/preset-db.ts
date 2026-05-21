import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { customPresets, type StoredPresetGeometry } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"

export type { StoredPresetGeometry } from "@/lib/db/schema"

export type CustomPresetRecord = {
  id: string
  userId: string
  name: string
  slotCount: number
  geometry: StoredPresetGeometry
  createdAt: Date
  updatedAt: Date
}

type CustomPresetRow = {
  id: string
  userId: string
  name: string
  slotCount: number
  geometry: StoredPresetGeometry
  createdAt: string
  updatedAt: string
}

function rowToPreset(row: CustomPresetRow): CustomPresetRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slotCount: row.slotCount,
    geometry: row.geometry,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
  }
}

export async function listCustomPresets(userId: string) {
  const rows = await getDb()
    .select()
    .from(customPresets)
    .where(eq(customPresets.userId, userId))
    .orderBy(desc(customPresets.createdAt))

  return rows.map(rowToPreset)
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
  const now = toD1Date(new Date())
  await getDb().insert(customPresets).values({
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
  return getDb()
    .update(customPresets)
    .set({
      name,
      slotCount,
      geometry,
      updatedAt: toD1Date(new Date()),
    })
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)))
    .run()
}

export async function deleteCustomPreset({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  return getDb()
    .delete(customPresets)
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)))
    .run()
}

export async function getCustomPreset({
  id,
  userId,
}: {
  id: string
  userId: string
}) {
  const row = await getDb()
    .select()
    .from(customPresets)
    .where(and(eq(customPresets.id, id), eq(customPresets.userId, userId)))
    .get()

  return row ? rowToPreset(row) : null
}
