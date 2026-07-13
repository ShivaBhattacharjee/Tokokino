import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  getUserDraftStorageUsage,
  MAX_USER_DRAFT_STORAGE_BYTES,
} from "@/lib/draft-db"
import {
  createDraftMedia,
  getUnattachedDraftMediaSize,
} from "@/lib/draft-media-db"
import { getStoredDraftMediaSize, uploadDraftMedia } from "@/lib/draft-storage"
import { draftMediaUrl } from "@/lib/schemas/draft"

export const runtime = "nodejs"

const MAX_VIDEO_BYTES = 1024 * 1024 * 1024

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const contentType = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]
  if (contentType !== "video/mp4" && contentType !== "video/webm")
    return NextResponse.json(
      { error: "Draft videos must be MP4 or WebM" },
      { status: 415 }
    )
  const sizeBytes = Number(request.headers.get("content-length") ?? "0")
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > MAX_VIDEO_BYTES ||
    !request.body
  )
    return NextResponse.json({ error: "Invalid video upload" }, { status: 400 })
  const [used, pending] = await Promise.all([
    getUserDraftStorageUsage(auth.session.user.id),
    getUnattachedDraftMediaSize(auth.session.user.id),
  ])
  if (used + pending + sizeBytes > MAX_USER_DRAFT_STORAGE_BYTES)
    return NextResponse.json(
      { error: "Storage limit reached" },
      { status: 413 }
    )
  const id = crypto.randomUUID()
  try {
    const objectKey = await uploadDraftMedia({
      userId: auth.session.user.id,
      id,
      body: request.body,
      contentType,
      contentLength: sizeBytes,
    })
    // The declared Content-Length is client-supplied; persist the size R2
    // actually stored so future quota checks don't under-count the object.
    const storedBytes = (await getStoredDraftMediaSize(objectKey)) ?? sizeBytes
    await createDraftMedia({
      id,
      userId: auth.session.user.id,
      objectKey,
      contentType,
      sizeBytes: storedBytes,
    })
    return NextResponse.json({ id, url: draftMediaUrl(id) })
  } catch (error) {
    console.error("Could not upload draft video", error)
    return NextResponse.json(
      { error: "Could not upload draft video" },
      { status: 502 }
    )
  }
}
