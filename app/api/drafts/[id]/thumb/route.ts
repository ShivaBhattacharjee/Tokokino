import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { getDraftMetadata, setDraftThumbnail } from "@/lib/draft-db"
import {
  MAX_DRAFT_THUMBNAIL_BYTES,
  getDraftThumbnail,
  uploadDraftThumbnail,
} from "@/lib/draft-storage"

export const runtime = "nodejs"

/**
 * Saved-draft thumbnail proxy + uploader. Drafts are private to the owning
 * user — the canvas may contain personal content — so this endpoint
 * authenticates every request and scopes draft lookups to the session user
 * before serving or accepting bytes.
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const draft = await getDraftMetadata({ id, userId: auth.session.user.id })
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!draft.thumbnailKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const response = await getDraftThumbnail({
      userId: auth.session.user.id,
      id,
    })
    const body = response.Body?.transformToWebStream()
    if (!body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": response.ContentType ?? "image/jpeg",
        // Owner-only — never let intermediaries cache.
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not load thumbnail" },
      { status: 500 }
    )
  }
}

export async function POST(
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

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase()
  if (
    !contentType.startsWith("image/jpeg") &&
    !contentType.startsWith("image/png") &&
    !contentType.startsWith("image/webp")
  ) {
    return NextResponse.json(
      { error: "Thumbnail must be a JPEG, PNG, or WebP image" },
      { status: 415 }
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_DRAFT_THUMBNAIL_BYTES) {
    return NextResponse.json(
      { error: "Thumbnail is too large" },
      { status: 413 }
    )
  }

  const image = new Uint8Array(await request.arrayBuffer())
  if (image.byteLength === 0) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 })
  }
  if (image.byteLength > MAX_DRAFT_THUMBNAIL_BYTES) {
    return NextResponse.json(
      { error: "Thumbnail is too large" },
      { status: 413 }
    )
  }

  try {
    const key = await uploadDraftThumbnail({
      userId: auth.session.user.id,
      id,
      body: image,
      contentType,
    })
    await setDraftThumbnail({
      id,
      userId: auth.session.user.id,
      thumbnailKey: key,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not save thumbnail" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
