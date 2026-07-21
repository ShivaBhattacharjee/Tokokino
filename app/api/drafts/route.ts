import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  MAX_USER_DRAFT_STORAGE_BYTES,
  countDrafts,
  createDraft,
  getUserDraftStorageUsage,
  listDrafts,
  searchDrafts,
} from "@/lib/draft-db"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  draftListQuerySchema,
  parseDraftSaveBody,
  resolveDraftType,
} from "@/lib/schemas/draft"
import { attachDraftMedia, getDraftMediaForSave } from "@/lib/draft-media-db"
import { extractDraftMediaIds } from "@/lib/schemas/draft"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const { limit, offset, sort, type, q } = draftListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  })

  try {
    // A search ranks by fuzzy match (typo-tolerant) and returns its own total,
    // so page and count always come from one ranking. Plain listing keeps the
    // indexed SQL path.
    const [listed, storageUsed] = await Promise.all([
      q
        ? searchDrafts(auth.session.user.id, { q, limit, offset, sort, type })
        : Promise.all([
            listDrafts(auth.session.user.id, { limit, offset, sort, type }),
            countDrafts(auth.session.user.id, { type }),
          ]).then(([rows, total]) => ({ rows, total })),
      getUserDraftStorageUsage(auth.session.user.id),
    ])
    const { rows: draftRows, total } = listed

    return NextResponse.json({
      drafts: draftRows.map((draft) => ({
        id: draft.id,
        name: draft.name,
        canvasCount: draft.canvasCount,
        byteSize: draft.byteSize,
        type: draft.type,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        thumbnailUrl: draft.thumbnailKey
          ? `/api/drafts/${draft.id}/thumb`
          : null,
      })),
      total,
      hasMore: offset + draftRows.length < total,
      storage: { used: storageUsed, limit: MAX_USER_DRAFT_STORAGE_BYTES },
    })
  } catch (error) {
    console.error("[GET /api/drafts]", error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not load drafts"
    // Surface a clearer hint when the draft type migration is missing.
    const needsMigration =
      /no such column:\s*type/i.test(message) ||
      /type.*does not exist/i.test(message)
    return NextResponse.json(
      {
        error: needsMigration
          ? "Database is missing the draft type column. Apply migrations (0007_draft_type)."
          : "Could not load drafts",
        detail: message,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "draft-create",
    id: auth.session.user.id,
  })
  if (limited) return limited

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_DRAFT_BYTES) {
    return NextResponse.json(
      { error: "Project is too large to save" },
      { status: 413 }
    )
  }

  const bodyText = await request.text().catch(() => null)
  if (!bodyText) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  const parsed = parseDraftSaveBody(body, { requireName: true })
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const stateBytes = new TextEncoder().encode(JSON.stringify(parsed.state))
  if (stateBytes.byteLength > MAX_DRAFT_BYTES) {
    return NextResponse.json(
      { error: "Project is too large to save" },
      { status: 413 }
    )
  }

  const mediaIds = extractDraftMediaIds(parsed.state)
  const media = await getDraftMediaForSave(mediaIds, auth.session.user.id)
  if (!media)
    return NextResponse.json(
      { error: "Draft video is unavailable" },
      { status: 400 }
    )
  const byteSize =
    stateBytes.byteLength +
    media.reduce((total, item) => total + item.sizeBytes, 0)
  const storageUsed = await getUserDraftStorageUsage(auth.session.user.id)
  if (storageUsed + byteSize > MAX_USER_DRAFT_STORAGE_BYTES) {
    return NextResponse.json(
      {
        error: "Storage limit reached",
        storage: { used: storageUsed, limit: MAX_USER_DRAFT_STORAGE_BYTES },
      },
      { status: 413 }
    )
  }

  const canvasCount = countCanvasesInDraftState(parsed.state)
  const type = resolveDraftType(parsed.state)
  const id = crypto.randomUUID()

  try {
    await createDraft({
      id,
      userId: auth.session.user.id,
      name: parsed.name!,
      canvasCount,
      byteSize,
      type,
      stateBytes,
      thumbnailKey: null,
    })
    await attachDraftMedia(mediaIds, auth.session.user.id, id)
  } catch (error) {
    console.error(error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not save draft"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({
    draft: {
      id,
      name: parsed.name!,
      canvasCount,
      byteSize,
      type,
    },
  })
}
