import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  createDraft,
  listDrafts,
} from "@/lib/draft-db"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  createDraftBodySchema,
} from "@/lib/schemas/draft"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const drafts = await listDrafts(auth.session.user.id)
  return NextResponse.json({
    drafts: drafts.map((draft) => ({
      id: draft.id,
      name: draft.name,
      canvasCount: draft.canvasCount,
      byteSize: draft.byteSize,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      thumbnailUrl: draft.thumbnailKey
        ? `/api/drafts/${draft.id}/thumb`
        : null,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const body: unknown = await request.json().catch(() => null)
  const parsed = createDraftBodySchema.safeParse(body)
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

  const canvasCount = countCanvasesInDraftState(state)
  const id = crypto.randomUUID()

  try {
    await createDraft({
      id,
      userId: auth.session.user.id,
      name,
      canvasCount,
      byteSize: stateBytes.byteLength,
      state,
      thumbnailKey: null,
    })
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
      name,
      canvasCount,
      byteSize: stateBytes.byteLength,
    },
  })
}
