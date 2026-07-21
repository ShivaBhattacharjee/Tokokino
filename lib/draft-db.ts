import "server-only"

import { and, asc, count, desc, eq, sql } from "drizzle-orm"
import Fuse from "fuse.js"

import { drafts, type DraftType } from "@/lib/db/schema"
import { fromD1Date, getDb, toD1Date } from "@/lib/d1"
import { getDraftState, uploadDraftState } from "@/lib/draft-storage"

export type { DraftType }

/** Per-user storage budget for saved draft state: 1 GB. */
export const MAX_USER_DRAFT_STORAGE_BYTES = 1024 * 1024 * 1024

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
  type: DraftType
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
  type: DraftType | null
  stateKey: string
  thumbnailKey: string | null
  createdAt: string
  updatedAt: string
}

function normalizeDraftType(type: DraftType | null | undefined): DraftType {
  return type === "animate" || type === "video" ? type : "style"
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
    type: normalizeDraftType(row.type),
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

/** Shared owner + kind filter for the list and its count. */
function draftListFilter(userId: string, opts: { type?: DraftType }) {
  if (opts.type === "animate" || opts.type === "video" || opts.type === "style")
    return and(eq(drafts.userId, userId), eq(drafts.type, opts.type))
  return eq(drafts.userId, userId)
}

/**
 * Most recent drafts a fuzzy search will rank. D1 has no trigram index or
 * edit-distance function, so typo tolerance has to happen in JS over a candidate
 * set — this bounds that scan. Metadata rows are small (no state blob), so a few
 * hundred is cheap; beyond this the oldest drafts drop out of search rather than
 * the request getting slow.
 */
const SEARCH_CANDIDATE_LIMIT = 500

/**
 * How far a name may stray from the query. Fuse scores 0 (exact) → 1 (no
 * relation); 0.4 catches ordinary typos and partial words without matching
 * everything. `ignoreLocation` matters: without it Fuse heavily favours matches
 * near the start, so searching a word from the END of a name would miss.
 */
const FUZZY_THRESHOLD = 0.4

/**
 * Fuzzy name search, ranked best-match-first, then paginated.
 *
 * Ranking happens over the whole candidate set BEFORE slicing, so page 2 is the
 * genuine next-best matches rather than a second, separately-ranked query.
 * Returns the match count alongside the page so the caller's pagination and its
 * total always come from one ranking.
 */
export async function searchDrafts(
  userId: string,
  opts: {
    q: string
    limit?: number
    offset?: number
    sort?: "latest" | "oldest"
    type?: DraftType
  }
) {
  const { q, limit = 12, offset = 0, sort = "latest", type } = opts
  const order =
    sort === "oldest" ? asc(drafts.updatedAt) : desc(drafts.updatedAt)

  const candidates = await getDb()
    .select()
    .from(drafts)
    .where(draftListFilter(userId, { type }))
    .orderBy(order)
    .limit(SEARCH_CANDIDATE_LIMIT)

  const fuse = new Fuse(candidates, {
    keys: ["name"],
    threshold: FUZZY_THRESHOLD,
    ignoreLocation: true,
    // One-character queries match nearly everything; wait for a real prefix.
    minMatchCharLength: 2,
  })
  const ranked = fuse.search(q).map((hit) => hit.item)

  return {
    rows: ranked.slice(offset, offset + limit).map(rowToDraftMetadata),
    total: ranked.length,
  }
}

export async function listDrafts(
  userId: string,
  opts: {
    limit?: number
    offset?: number
    sort?: "latest" | "oldest"
    type?: DraftType
  } = {}
) {
  const { limit = 12, offset = 0, sort = "latest" } = opts
  const order =
    sort === "oldest" ? asc(drafts.updatedAt) : desc(drafts.updatedAt)

  const rows = await getDb()
    .select()
    .from(drafts)
    .where(draftListFilter(userId, opts))
    .orderBy(order)
    .limit(limit)
    .offset(offset)

  return rows.map(rowToDraftMetadata)
}

export async function getUserDraftStorageUsage(
  userId: string
): Promise<number> {
  const row = await getDb()
    .select({
      total: sql<number>`COALESCE(SUM(${drafts.byteSize}), 0)`,
    })
    .from(drafts)
    .where(eq(drafts.userId, userId))
    .get()
  return Number(row?.total ?? 0)
}

export async function countDrafts(
  userId: string,
  opts: { type?: DraftType } = {}
) {
  const result = await getDb()
    .select({ count: count() })
    .from(drafts)
    .where(draftListFilter(userId, opts))
    .get()
  return result?.count ?? 0
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
  type,
  stateBytes,
  thumbnailKey,
}: {
  id: string
  userId: string
  name: string
  canvasCount: number
  byteSize: number
  type: DraftType
  stateBytes: Uint8Array
  thumbnailKey: string | null
}) {
  const stateKey = await uploadDraftState({ userId, id, body: stateBytes })
  const now = toD1Date(new Date())

  await getDb().insert(drafts).values({
    id,
    userId,
    name,
    canvasCount,
    byteSize,
    type,
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
  type,
  stateBytes,
  thumbnailKey,
}: {
  id: string
  userId: string
  name?: string
  canvasCount: number
  byteSize: number
  type: DraftType
  stateBytes: Uint8Array
  thumbnailKey?: string | null
}) {
  const existing = await getDraftMetadata({ id, userId })
  if (!existing) return null

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
      type,
      stateKey,
      thumbnailKey: nextThumbnailKey,
      updatedAt: now,
    })
    .where(and(eq(drafts.id, id), eq(drafts.userId, userId)))

  return {
    id,
    name: nextName,
    canvasCount,
    byteSize,
    type,
    updatedAt: fromD1Date(now) ?? new Date(now),
  }
}

/** Rename a draft owned by `userId`; returns updated metadata or null if missing. */
export async function renameDraft({
  id,
  userId,
  name,
}: {
  id: string
  userId: string
  name: string
}) {
  const existing = await getDraftMetadata({ id, userId })
  if (!existing) return null

  await getDb()
    .update(drafts)
    .set({ name, updatedAt: toD1Date(new Date()) })
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
