import "server-only"

import { createHash } from "node:crypto"
import type { Collection, MongoServerError } from "mongodb"

import { getConnectedMongoClient } from "@/lib/mongo"
import { env } from "./env"

export type ShareRecord = {
  id: string
  key: string
  imageUrl: string
  imageHash?: string
  userId: string
  userName: string | null
  userEmail: string | null
  createdAt: Date
  updatedAt: Date
  lastViewedAt: Date | null
  viewCount: number
  uniqueViewCount: number
}

type ShareViewRecord = {
  shareId: string
  ipHash: string
  userAgent: string | null
  firstViewedAt: Date
  lastViewedAt: Date
  visitCount: number
}

type ShareUser = {
  id: string
  name?: string | null
  email?: string | null
}

let indexPromise: Promise<void> | null = null

async function getCollections() {
  const client = await getConnectedMongoClient()
  const db = client.db()
  return {
    shares: db.collection<ShareRecord>("shares"),
    shareViews: db.collection<ShareViewRecord>("shareViews"),
  }
}

async function ensureIndexes(
  shares: Collection<ShareRecord>,
  shareViews: Collection<ShareViewRecord>
) {
  indexPromise ??= Promise.all([
    shares.createIndex({ id: 1 }, { unique: true }),
    shares.createIndex({ userId: 1, createdAt: -1 }),
    shares.createIndex({ userId: 1, imageHash: 1 }),
    shareViews.createIndex({ shareId: 1, ipHash: 1 }, { unique: true }),
    shareViews.createIndex({ shareId: 1, lastViewedAt: -1 }),
  ]).then(() => undefined)

  await indexPromise
}

export async function createShareRecord({
  id,
  key,
  imageUrl,
  imageHash,
  user,
}: {
  id: string
  key: string
  imageUrl: string
  imageHash: string
  user: ShareUser
}) {
  const { shares, shareViews } = await getCollections()
  await ensureIndexes(shares, shareViews)

  const now = new Date()
  await shares.insertOne({
    id,
    key,
    imageUrl,
    imageHash,
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

export async function findShareByImageHashForUser({
  imageHash,
  userId,
}: {
  imageHash: string
  userId: string
}) {
  const { shares, shareViews } = await getCollections()
  await ensureIndexes(shares, shareViews)

  return shares.findOne(
    { imageHash, userId },
    { sort: { createdAt: -1 } }
  )
}

export async function recordShareView(id: string, requestHeaders: Headers) {
  const { shares, shareViews } = await getCollections()
  await ensureIndexes(shares, shareViews)

  const share = await shares.findOne({ id })
  if (!share) return null

  const now = new Date()
  const ipHash = hashIpAddress(getClientIp(requestHeaders))
  const userAgent = requestHeaders.get("user-agent")

  try {
    await shareViews.insertOne({
      shareId: id,
      ipHash,
      userAgent,
      firstViewedAt: now,
      lastViewedAt: now,
      visitCount: 1,
    })

    const updated = await shares.findOneAndUpdate(
      { id },
      {
        $inc: { viewCount: 1, uniqueViewCount: 1 },
        $set: { lastViewedAt: now, updatedAt: now },
      },
      { returnDocument: "after" }
    )

    return updated ?? share
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error

    await shareViews.updateOne(
      { shareId: id, ipHash },
      {
        $inc: { visitCount: 1 },
        $set: { lastViewedAt: now, userAgent },
      }
    )

    const updated = await shares.findOneAndUpdate(
      { id },
      {
        $inc: { viewCount: 1 },
        $set: { lastViewedAt: now, updatedAt: now },
      },
      { returnDocument: "after" }
    )

    return updated ?? share
  }
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

function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MongoServerError).code === 11000
  )
}
