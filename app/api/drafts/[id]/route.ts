import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  MAX_USER_DRAFT_STORAGE_BYTES,
  deleteDraft,
  getDraft,
  getDraftMetadata,
  getUserDraftStorageUsage,
  updateDraft,
} from "@/lib/draft-db"
import { deleteDraftState, deleteDraftThumbnail } from "@/lib/draft-storage"
import {
  attachDraftMedia,
  deleteDraftMedia,
  getDraftMediaForDraft,
  getDraftMediaForSave,
} from "@/lib/draft-media-db"
import { deleteDraftMediaObject } from "@/lib/draft-storage"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  extractDraftMediaIds,
  parseDraftSaveBody,
  resolveDraftType,
} from "@/lib/schemas/draft"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const draft = await getDraft({ id, userId: auth.session.user.id })
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  return NextResponse.json({
    draft: {
      id: draft.id,
      name: draft.name,
      canvasCount: draft.canvasCount,
      byteSize: draft.byteSize,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      state: draft.state,
    },
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const existing = await getDraftMetadata({ id, userId: auth.session.user.id })
  if (!existing) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

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

  const parsed = parseDraftSaveBody(body, { requireName: false })
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
  const media = await getDraftMediaForSave(mediaIds, auth.session.user.id, id)
  if (!media)
    return NextResponse.json(
      { error: "Draft video is unavailable" },
      { status: 400 }
    )
  const byteSize =
    stateBytes.byteLength +
    media.reduce((total, item) => total + item.sizeBytes, 0)
  const storageUsed = await getUserDraftStorageUsage(auth.session.user.id)
  const projectedUsage = storageUsed - existing.byteSize + byteSize
  if (projectedUsage > MAX_USER_DRAFT_STORAGE_BYTES) {
    return NextResponse.json(
      {
        error: "Storage limit reached",
        storage: { used: storageUsed, limit: MAX_USER_DRAFT_STORAGE_BYTES },
      },
      { status: 413 }
    )
  }

  // Supports both the new wrapped shape ({ present, ui }) and the legacy
  // raw EditorState shape that older drafts may still be persisted as.
  const canvasCount =
    countCanvasesInDraftState(parsed.state) || existing.canvasCount
  const type = resolveDraftType(parsed.state)

  try {
    const updated = await updateDraft({
      id,
      userId: auth.session.user.id,
      name: parsed.name,
      canvasCount,
      byteSize,
      type,
      stateBytes,
    })
    await attachDraftMedia(mediaIds, auth.session.user.id, id)
    const previousMedia = await getDraftMediaForDraft(id, auth.session.user.id)
    const removedMedia = previousMedia.filter(
      (item) => !mediaIds.includes(item.id)
    )
    await Promise.all(
      removedMedia.map((item) => deleteDraftMediaObject(item.objectKey))
    )
    await deleteDraftMedia(
      removedMedia.map((item) => item.id),
      auth.session.user.id
    )
    return NextResponse.json({
      draft: {
        id,
        name: updated?.name ?? existing.name,
        canvasCount,
        byteSize,
        type: updated?.type ?? type,
        updatedAt: updated?.updatedAt ?? new Date(),
      },
    })
  } catch (error) {
    console.error(error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not save draft"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  try {
    const media = await getDraftMediaForDraft(id, auth.session.user.id)
    const existing = await deleteDraft({ id, userId: auth.session.user.id })
    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    }
    await deleteDraftThumbnail({
      userId: auth.session.user.id,
      id,
      thumbnailKey: existing.thumbnailKey,
    })
    await deleteDraftState({
      userId: auth.session.user.id,
      id,
      stateKey: existing.stateKey,
    })
    await Promise.all(
      media.map((item) => deleteDraftMediaObject(item.objectKey))
    )
    await deleteDraftMedia(
      media.map((item) => item.id),
      auth.session.user.id
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not delete draft" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
