import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { createDraft, listDrafts } from "@/lib/draft-db"
import {
  MAX_DRAFT_BYTES,
  countCanvasesInDraftState,
  parseDraftSaveBody,
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
      thumbnailUrl: draft.thumbnailKey ? `/api/drafts/${draft.id}/thumb` : null,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

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

  const canvasCount = countCanvasesInDraftState(parsed.state)
  const id = crypto.randomUUID()

  try {
    await createDraft({
      id,
      userId: auth.session.user.id,
      name: parsed.name!,
      canvasCount,
      byteSize: stateBytes.byteLength,
      stateBytes,
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
      name: parsed.name!,
      canvasCount,
      byteSize: stateBytes.byteLength,
    },
  })
}
