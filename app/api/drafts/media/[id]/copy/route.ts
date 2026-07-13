import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  getUserDraftStorageUsage,
  MAX_USER_DRAFT_STORAGE_BYTES,
} from "@/lib/draft-db"
import {
  createDraftMedia,
  getDraftMedia,
  getUnattachedDraftMediaSize,
} from "@/lib/draft-media-db"
import { copyDraftMedia } from "@/lib/draft-storage"
import { draftMediaUrl } from "@/lib/schemas/draft"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id: sourceId } = await params
  const source = await getDraftMedia(sourceId, auth.session.user.id)
  if (!source)
    return NextResponse.json(
      { error: "Draft video not found" },
      { status: 404 }
    )

  const [used, pending] = await Promise.all([
    getUserDraftStorageUsage(auth.session.user.id),
    getUnattachedDraftMediaSize(auth.session.user.id),
  ])
  if (used + pending + source.sizeBytes > MAX_USER_DRAFT_STORAGE_BYTES) {
    return NextResponse.json(
      { error: "Storage limit reached" },
      { status: 413 }
    )
  }

  const id = crypto.randomUUID()
  try {
    const objectKey = await copyDraftMedia({
      userId: auth.session.user.id,
      id,
      sourceKey: source.objectKey,
      contentType: source.contentType,
    })
    await createDraftMedia({
      id,
      userId: auth.session.user.id,
      objectKey,
      contentType: source.contentType,
      sizeBytes: source.sizeBytes,
    })
    return NextResponse.json({ id, url: draftMediaUrl(id) })
  } catch (error) {
    console.error("Could not copy draft video", error)
    return NextResponse.json(
      { error: "Could not copy draft video" },
      { status: 502 }
    )
  }
}
