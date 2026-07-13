import { NextResponse } from "next/server"

import {
  getConfirmedShareUploadBytes,
  getShareUploadForUser,
  getShareUploadParts,
  isShareUploadExpired,
  recordShareUploadPart,
  setShareUploadCancelled,
} from "@/lib/share-upload-db"
import {
  abortShareMultipartUpload,
  listShareMultipartParts,
} from "@/lib/share-storage"
import {
  requireShareUploadUser,
  uploadStatusResponse,
} from "@/lib/share-upload-server"
import { isValidShareId } from "@/lib/share"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response
  const { id } = await params
  if (!isValidShareId(id))
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })

  const upload = await getShareUploadForUser(id, session.user.id)
  if (!upload)
    return NextResponse.json({ error: "Upload not found" }, { status: 404 })
  if (await isShareUploadExpired(upload)) {
    await abortShareMultipartUpload({
      objectKey: upload.objectKey,
      r2UploadId: upload.r2UploadId,
    }).catch(() => {})
    await setShareUploadCancelled(upload.id, session.user.id)
    return NextResponse.json({ error: "Upload expired" }, { status: 410 })
  }

  if (upload.status === "active" || upload.status === "finalizing") {
    const remoteParts = await listShareMultipartParts({
      objectKey: upload.objectKey,
      r2UploadId: upload.r2UploadId,
    }).catch(() => [])
    await Promise.all(
      remoteParts.map((part) =>
        recordShareUploadPart({ uploadId: upload.id, ...part })
      )
    )
  }
  const [parts, confirmedBytes] = await Promise.all([
    getShareUploadParts(upload.id),
    getConfirmedShareUploadBytes(upload.id),
  ])
  return NextResponse.json(
    uploadStatusResponse(
      upload,
      confirmedBytes,
      parts.map((part) => part.partNumber)
    )
  )
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response
  const { id } = await params
  if (!isValidShareId(id))
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })
  const upload = await getShareUploadForUser(id, session.user.id)
  if (!upload)
    return NextResponse.json({ error: "Upload not found" }, { status: 404 })
  if (upload.status === "complete") {
    return NextResponse.json(
      { error: "Completed uploads cannot be cancelled" },
      { status: 409 }
    )
  }
  await abortShareMultipartUpload({
    objectKey: upload.objectKey,
    r2UploadId: upload.r2UploadId,
  }).catch(() => {})
  await setShareUploadCancelled(upload.id, session.user.id)
  return NextResponse.json({ ok: true })
}
