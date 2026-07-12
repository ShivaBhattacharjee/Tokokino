import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

import { getShareImageUrl } from "@/lib/share"
import { createShareRecord, getShareById } from "@/lib/share-db"
import {
  getShareUploadForUser,
  getShareUploadParts,
  isShareUploadExpired,
  markShareUploadComplete,
  markShareUploadFinalizing,
} from "@/lib/share-upload-db"
import {
  completeShareMultipartUpload,
  getShareMultipartObject,
} from "@/lib/share-storage"
import { requireShareUploadUser } from "@/lib/share-upload-server"
import { isValidShareId } from "@/lib/share"
import { shareTypeForContentType } from "@/lib/share-image"

export const runtime = "nodejs"

const PART_BYTES = 8 * 1024 * 1024

function expectedPartCount(sizeBytes: number) {
  return Math.ceil(sizeBytes / PART_BYTES)
}

async function objectWasCompleted(upload: {
  objectKey: string
  id: string
  sizeBytes: number
}) {
  const object = await getShareMultipartObject(upload.objectKey).catch(
    () => null
  )
  const uploadId =
    object?.Metadata?.shareuploadid ?? object?.Metadata?.shareUploadId
  return uploadId === upload.id && object?.ContentLength === upload.sizeBytes
}

export async function POST(
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

  const existingShare = await getShareById(upload.shareId)
  if (upload.status === "complete" && existingShare) {
    return NextResponse.json({
      id: upload.shareId,
      url: new URL(`/share/${upload.shareId}`, request.url).toString(),
    })
  }
  if (upload.status === "cancelled") {
    return NextResponse.json({ error: "Upload was cancelled" }, { status: 409 })
  }
  if (await isShareUploadExpired(upload)) {
    return NextResponse.json({ error: "Upload expired" }, { status: 410 })
  }

  const parts = await getShareUploadParts(upload.id)
  const expected = expectedPartCount(upload.sizeBytes)
  if (
    parts.length !== expected ||
    parts.some((part, index) => {
      const expectedSize =
        index === expected - 1
          ? upload.sizeBytes - index * PART_BYTES
          : PART_BYTES
      return part.partNumber !== index + 1 || part.sizeBytes !== expectedSize
    })
  ) {
    return NextResponse.json({ error: "Upload is incomplete" }, { status: 409 })
  }

  const finalizingUpload = await markShareUploadFinalizing(
    upload.id,
    session.user.id
  )
  if (!finalizingUpload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 })
  }

  try {
    const completed = await objectWasCompleted(finalizingUpload)
    if (!completed) {
      await completeShareMultipartUpload({
        objectKey: finalizingUpload.objectKey,
        r2UploadId: finalizingUpload.r2UploadId,
        parts: parts.map((part) => ({
          partNumber: part.partNumber,
          etag: part.etag,
        })),
      })
    }
    const imageUrl = getShareImageUrl(finalizingUpload.shareId, request.url)
    const existing = await getShareById(finalizingUpload.shareId)
    if (!existing) {
      await createShareRecord({
        id: finalizingUpload.shareId,
        key: finalizingUpload.objectKey,
        imageUrl,
        imageHash: createHash("sha256")
          .update(finalizingUpload.id)
          .digest("hex"),
        sizeBytes: finalizingUpload.sizeBytes,
        type: shareTypeForContentType(
          finalizingUpload.contentType as
            | "video/mp4"
            | "video/webm"
            | "image/gif"
        ),
        contentType: finalizingUpload.contentType,
        user: session.user,
      })
    }
    await markShareUploadComplete(finalizingUpload.id, session.user.id)
    return NextResponse.json({
      id: finalizingUpload.shareId,
      url: new URL(
        `/share/${finalizingUpload.shareId}`,
        request.url
      ).toString(),
    })
  } catch (error) {
    console.error("Could not complete share upload", error)
    return NextResponse.json(
      { error: "Could not complete upload" },
      { status: 502 }
    )
  }
}
