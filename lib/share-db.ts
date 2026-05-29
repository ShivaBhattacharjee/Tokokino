import "server-only"

import { createHash } from "node:crypto"

import { and, desc, eq, sql } from "drizzle-orm"

import { shares, shareViews } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"
import { env } from "./env"

/** Per-user storage budget for shared images: 1 GB. */
export const MAX_USER_SHARE_STORAGE_BYTES = 1024 * 1024 * 1024

export type ShareRecord = {
  id: string
  key: string
  imageUrl: string
  imageHash?: string
  sizeBytes: number
  userId: string
  userName: string | null
  userEmail: string | null
  createdAt: Date
  updatedAt: Date
  lastViewedAt: Date | null
  viewCount: number
  uniqueViewCount: number
}

type ShareRow = {
  id: string
  objectKey: string
  imageUrl: string
  imageHash: string | null
  sizeBytes: number
  userId: string
  userName: string | null
  userEmail: string | null
  createdAt: string
  updatedAt: string
  lastViewedAt: string | null
  viewCount: number
  uniqueViewCount: number
}

type ShareUser = {
  id: string
  name?: string | null
  email?: string | null
}

function rowToShare(row: ShareRow): ShareRecord {
  return {
    id: row.id,
    key: row.objectKey,
    imageUrl: row.imageUrl,
    imageHash: row.imageHash ?? undefined,
    sizeBytes: row.sizeBytes ?? 0,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    createdAt: fromD1Date(row.createdAt) ?? new Date(row.createdAt),
    updatedAt: fromD1Date(row.updatedAt) ?? new Date(row.updatedAt),
    lastViewedAt: fromD1Date(row.lastViewedAt),
    viewCount: row.viewCount,
    uniqueViewCount: row.uniqueViewCount,
  }
}

export async function getUserShares(
  userId: string,
  limit = 50,
  offset = 0
): Promise<ShareRecord[]> {
  const rows = await getDb()
    .select()
    .from(shares)
    .where(eq(shares.userId, userId))
    .orderBy(desc(shares.createdAt))
    .limit(limit)
    .offset(offset)
    .all()
  return rows.map(rowToShare)
}

export async function getUserStorageUsage(userId: string): Promise<number> {
  const row = await getDb()
    .select({
      total: sql<number>`COALESCE(SUM(${shares.sizeBytes}), 0)`,
    })
    .from(shares)
    .where(eq(shares.userId, userId))
    .get()
  return Number(row?.total ?? 0)
}

export async function deleteShareRecord(id: string, userId: string) {
  await getDb()
    .delete(shares)
    .where(and(eq(shares.id, id), eq(shares.userId, userId)))
}

export async function deleteAllUserShares(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: shares.id })
    .from(shares)
    .where(eq(shares.userId, userId))
    .all()
  if (rows.length === 0) return []
  await getDb().delete(shares).where(eq(shares.userId, userId))
  return rows.map((r) => r.id)
}

export async function createShareRecord({
  id,
  key,
  imageUrl,
  imageHash,
  sizeBytes,
  user,
}: {
  id: string
  key: string
  imageUrl: string
  imageHash: string
  sizeBytes: number
  user: ShareUser
}) {
  const now = toD1Date(new Date())
  await getDb()
    .insert(shares)
    .values({
      id,
      objectKey: key,
      imageUrl,
      imageHash,
      sizeBytes,
      userId: user.id,
      userName: user.name ?? null,
      userEmail: user.email ?? null,
      createdAt: now,
      updatedAt: now,
      lastViewedAt: null,
      viewCount: 0,
      uniqueViewCount: 0,
    })
}

export async function recordShareView(id: string, requestHeaders: Headers) {
  const db = getDb()
  const share = await db.select().from(shares).where(eq(shares.id, id)).get()

  if (!share) return null

  const now = toD1Date(new Date())
  const ipHash = hashIpAddress(getClientIp(requestHeaders))
  const userAgent = requestHeaders.get("user-agent")

  const insertedView = await db
    .insert(shareViews)
    .values({
      shareId: id,
      ipHash,
      userAgent,
      firstViewedAt: now,
      lastViewedAt: now,
      visitCount: 0,
    })
    .onConflictDoNothing()
    .run()

  const uniqueViewCount = insertedView.meta.changes > 0 ? 1 : 0

  await db
    .update(shareViews)
    .set({
      visitCount: sql`${shareViews.visitCount} + 1`,
      lastViewedAt: now,
      userAgent,
    })
    .where(and(eq(shareViews.shareId, id), eq(shareViews.ipHash, ipHash)))

  await db
    .update(shares)
    .set({
      viewCount: sql`${shares.viewCount} + 1`,
      uniqueViewCount: sql`${shares.uniqueViewCount} + ${uniqueViewCount}`,
      lastViewedAt: now,
      updatedAt: now,
    })
    .where(eq(shares.id, id))

  const updated = await db.select().from(shares).where(eq(shares.id, id)).get()

  return updated ? rowToShare(updated) : rowToShare(share)
}

function getClientIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"

  return (
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  )
}

function hashIpAddress(ip: string) {
  const secret = env.BETTER_AUTH_SECRET
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex")
}
