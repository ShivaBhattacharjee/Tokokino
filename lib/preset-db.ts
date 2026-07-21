import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"

import {
  customPresets,
  type CustomPresetType,
  type StoredPresetGeometry,
} from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"
import type { PresetSort } from "@/lib/schemas/preset"

export type { CustomPresetType, StoredPresetGeometry } from "@/lib/db/schema"

export type CustomPresetRecord = {
  id: string
  userId: string
  name: string
  slotCount: number
  type: CustomPresetType
  geometry: StoredPresetGeometry
  createdAt: Date
  updatedAt: Date
}

type CustomPresetRow = {
  id: string
  userId: string
  name: string
  slotCount: number
  type: CustomPresetType | null
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
    type: row.type === "animate" ? "animate" : "style",
    geometry: row.geometry,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
  }
}

export async function listCustomPresets(
  userId: string,
  opts: { sort?: PresetSort } = {}
) {
  const order =
    opts.sort === "oldest"
      ? asc(customPresets.createdAt)
      : desc(customPresets.createdAt)

  const rows = await getDb()
    .select()
    .from(customPresets)
    .where(eq(customPresets.userId, userId))
    .orderBy(order)

  return rows.map(rowToPreset)
}

export async function createCustomPreset({
  id,
  userId,
  name,
  slotCount,
  type,
  geometry,
}: {
  id: string
  userId: string
  name: string
  slotCount: number
  type: CustomPresetType
  geometry: StoredPresetGeometry
}) {
  const now = toD1Date(new Date())
  await getDb().insert(customPresets).values({
    id,
    userId,
    name,
    slotCount,
    type,
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
  type,
  geometry,
}: {
  id: string
  userId: string
  name: string
  slotCount: number
  type: CustomPresetType
  geometry: StoredPresetGeometry
}) {
  return getDb()
    .update(customPresets)
    .set({
      name,
      slotCount,
      type,
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
