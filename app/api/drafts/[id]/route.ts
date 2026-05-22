import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  deleteDraft,
  getDraft,
  getDraftMetadata,
  updateDraft,
} from "@/lib/draft-db"
import { deleteDraftState, deleteDraftThumbnail } from "@/lib/draft-storage"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  parseDraftSaveBody,
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

  // Supports both the new wrapped shape ({ present, ui }) and the legacy
  // raw EditorState shape that older drafts may still be persisted as.
  const canvasCount =
    countCanvasesInDraftState(parsed.state) || existing.canvasCount

  try {
    const updated = await updateDraft({
      id,
      userId: auth.session.user.id,
      name: parsed.name,
      canvasCount,
      byteSize: stateBytes.byteLength,
      stateBytes,
    })
    return NextResponse.json({
      draft: {
        id,
        name: updated?.name ?? existing.name,
        canvasCount,
        byteSize: stateBytes.byteLength,
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
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not delete draft" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
