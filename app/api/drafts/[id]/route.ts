import { NextResponse } from "next/server"

import { assertOwner, requireSession } from "@/lib/api-auth"
import {
  deleteDraft,
  getDraftById,
  updateDraft,
} from "@/lib/draft-db"
import { deleteDraftThumbnail } from "@/lib/draft-storage"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  updateDraftBodySchema,
} from "@/lib/schemas/draft"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const draft = await getDraftById(id)
  const ownership = assertOwner({
    session: auth.session,
    ownerId: draft?.userId,
  })
  if (ownership || !draft) {
    return ownership ?? NextResponse.json({ error: "Draft not found" }, { status: 404 })
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

  const existing = await getDraftById(id)
  const ownership = assertOwner({
    session: auth.session,
    ownerId: existing?.userId,
  })
  if (ownership || !existing) {
    return ownership ?? NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = updateDraftBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    )
  }
  const { name, state } = parsed.data

  const stateBytes = new TextEncoder().encode(JSON.stringify(state))
  if (stateBytes.byteLength > MAX_DRAFT_BYTES) {
    return NextResponse.json(
      { error: "Project is too large to save" },
      { status: 413 }
    )
  }

  // Supports both the new wrapped shape ({ present, ui }) and the legacy
  // raw EditorState shape that older drafts may still be persisted as.
  const canvasCount = countCanvasesInDraftState(state) || existing.canvasCount

  try {
    const updated = await updateDraft({
      id,
      userId: auth.session.user.id,
      name,
      canvasCount,
      byteSize: stateBytes.byteLength,
      state,
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

  const existing = await getDraftById(id)
  const ownership = assertOwner({
    session: auth.session,
    ownerId: existing?.userId,
  })
  if (ownership || !existing) {
    return ownership ?? NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  try {
    await deleteDraft({ id, userId: auth.session.user.id })
    await deleteDraftThumbnail({
      userId: auth.session.user.id,
      id,
      thumbnailKey: existing.thumbnailKey,
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
