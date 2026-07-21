import "server-only"

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm"
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
 * Order two matched drafts for display. Tie-broken by id to keep paging stable
 * ACROSS requests: drafts saved in the same second share an `updatedAt`, and
 * each page is its own request re-running this sort over rows D1 returns in no
 * guaranteed order. Without the tiebreak, tied drafts could land either side of
 * a page boundary on different requests and be shown twice or skipped.
 */
function compareByUpdated(
  a: { id: string; updatedAt: string },
  b: { id: string; updatedAt: string },
  sort: "latest" | "oldest"
) {
  const byDate =
    sort === "oldest"
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt)
  return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
}

/**
 * How far a name may stray from the query. Fuse scores 0 (exact) → 1 (no
 * relation); 0.4 catches ordinary typos and partial words without matching
 * everything. `ignoreLocation` matters: without it Fuse heavily favours matches
 * near the start, so searching a word from the END of a name would miss.
 */
const FUZZY_THRESHOLD = 0.4

/**
 * Fuzzy name search across EVERY draft the filter allows: relevance decides
 * which drafts match, `sort` decides the order, then the page is sliced.
 *
 * Two passes, because D1 has no trigram index or edit-distance function — typo
 * tolerance has to happen in JS, over rows this has already read. Reading whole
 * rows to do that would put the library size in the response budget, so the
 * match pass projects just the three columns matching and ordering need
 * (`name`, `updatedAt`, `id` — no state blob, no thumbnail key) and the second
 * pass hydrates only the page, by id. That keeps the scan cheap enough that no
 * candidate cap is needed, so an old draft is as findable as a recent one.
 *
 * Matching and ordering both happen over the whole match set BEFORE slicing, so
 * page 2 is the genuine continuation rather than a separately-ranked query.
 * Returns the match count alongside the page so the caller's pagination and its
 * total always come from one pass.
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
  const scope = draftListFilter(userId, { type })

  const candidates = await getDb()
    .select({
      id: drafts.id,
      name: drafts.name,
      updatedAt: drafts.updatedAt,
    })
    .from(drafts)
    .where(scope)

  const fuse = new Fuse(candidates, {
    keys: ["name"],
    threshold: FUZZY_THRESHOLD,
    ignoreLocation: true,
    // One-character queries match nearly everything; wait for a real prefix.
    minMatchCharLength: 2,
  })
  // updatedAt is an ISO-8601 UTC string, so lexicographic order is
  // chronological — the same ordering the SQL list path applies.
  const matches = fuse.search(q).map((hit) => hit.item)
  matches.sort((a, b) => compareByUpdated(a, b, sort))

  const pageIds = matches.slice(offset, offset + limit).map((m) => m.id)
  if (pageIds.length === 0) return { rows: [], total: matches.length }

  // Re-filtered by owner, not just id: the ids came from an owned query, but a
  // bare id lookup would be one refactor away from reading another user's row.
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(and(scope, inArray(drafts.id, pageIds)))

  // Order was decided once, above. `IN (...)` returns rows in no particular
  // order, so replay that sequence rather than sorting a second time — a second
  // sort would have to stay byte-identical to the first forever, and drifting
  // apart would silently page wrongly instead of failing. Drops any id deleted
  // between the two queries.
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = pageIds
    .map((id) => byId.get(id))
    .filter((row) => row !== undefined)

  return { rows: ordered.map(rowToDraftMetadata), total: matches.length }
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
