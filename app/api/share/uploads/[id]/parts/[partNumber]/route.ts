import { NextResponse } from "next/server"

import { detectShareImageContentType } from "@/lib/share-image"
import {
  getConfirmedShareUploadBytes,
  getShareUploadForUser,
  getShareUploadParts,
  isShareUploadExpired,
  recordShareUploadPart,
} from "@/lib/share-upload-db"
import {
  SHARE_UPLOAD_PART_BYTES,
  uploadShareMultipartPart,
} from "@/lib/share-storage"
import { requireShareUploadUser } from "@/lib/share-upload-server"
import { isValidShareId } from "@/lib/share"

export const runtime = "nodejs"

function parseContentRange(value: string | null) {
  const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    end < start ||
    total < 1
  ) {
    return null
  }
  return { start, end, total }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; partNumber: string }> }
) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response
  const { id, partNumber: rawPartNumber } = await params
  const partNumber = Number(rawPartNumber)
  if (
    !isValidShareId(id) ||
    !Number.isSafeInteger(partNumber) ||
    partNumber < 1
  ) {
    return NextResponse.json({ error: "Invalid upload part" }, { status: 400 })
  }

  const upload = await getShareUploadForUser(id, session.user.id)
  if (!upload)
    return NextResponse.json({ error: "Upload not found" }, { status: 404 })
  if (upload.status !== "active" || (await isShareUploadExpired(upload))) {
    return NextResponse.json({ error: "Upload is not active" }, { status: 409 })
  }
  const range = parseContentRange(request.headers.get("content-range"))
  const expectedStart = (partNumber - 1) * SHARE_UPLOAD_PART_BYTES
  const expectedEnd =
    Math.min(upload.sizeBytes, expectedStart + SHARE_UPLOAD_PART_BYTES) - 1
  const expectedSize = expectedEnd - expectedStart + 1
  if (
    !range ||
    range.total !== upload.sizeBytes ||
    range.start !== expectedStart ||
    range.end !== expectedEnd
  ) {
    return NextResponse.json({ error: "Invalid part range" }, { status: 400 })
  }

  const existing = (await getShareUploadParts(upload.id)).find(
    (part) => part.partNumber === partNumber
  )
  if (existing) {
    const confirmedBytes = await getConfirmedShareUploadBytes(upload.id)
    return NextResponse.json({ ok: true, confirmedBytes, duplicate: true })
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength !== expectedSize) {
    return NextResponse.json({ error: "Invalid part size" }, { status: 400 })
  }
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength !== expectedSize) {
    return NextResponse.json({ error: "Invalid part body" }, { status: 400 })
  }
  if (
    partNumber === 1 &&
    detectShareImageContentType(body) !== upload.contentType
  ) {
    return NextResponse.json(
      { error: "Media content does not match upload type" },
      { status: 415 }
    )
  }

  try {
    const etag = await uploadShareMultipartPart({
      objectKey: upload.objectKey,
      r2UploadId: upload.r2UploadId,
      partNumber,
      body,
    })
    await recordShareUploadPart({
      uploadId: upload.id,
      partNumber,
      etag,
      sizeBytes: body.byteLength,
    })
    const confirmedBytes = await getConfirmedShareUploadBytes(upload.id)
    return NextResponse.json({ ok: true, confirmedBytes, duplicate: false })
  } catch (error) {
    console.error("Could not upload share part", error)
    return NextResponse.json(
      { error: "Could not upload part" },
      { status: 502 }
    )
  }
}
