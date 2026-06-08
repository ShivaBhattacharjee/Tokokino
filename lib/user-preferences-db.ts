import "server-only"

import { eq } from "drizzle-orm"

import { userPreferences } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"

export type UserPreferencesRecord = {
  userId: string
  exportFilenameFormat: string | null
  createdAt: Date
  updatedAt: Date
}

type UserPreferencesRow = {
  userId: string
  exportFilenameFormat: string | null
  createdAt: string
  updatedAt: string
}

function rowToRecord(row: UserPreferencesRow): UserPreferencesRecord {
  return {
    userId: row.userId,
    exportFilenameFormat: row.exportFilenameFormat,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
  }
}

export async function getUserPreferences(userId: string) {
  const row = await getDb()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get()

  return row ? rowToRecord(row) : null
}

export async function setExportFilenameFormatPreference({
  userId,
  exportFilenameFormat,
}: {
  userId: string
  exportFilenameFormat: string | null
}) {
  const now = toD1Date(new Date())
  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      exportFilenameFormat,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { exportFilenameFormat, updatedAt: now },
    })
}
