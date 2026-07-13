import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { enforceRateLimit } from "@/lib/rate-limit"
import { getShareObjectKey, isValidShareId } from "@/lib/share"
import {
  canReserveShareUpload,
  createShareUpload,
  getConfirmedShareUploadBytes,
  getShareUploadForUser,
  getShareUploadParts,
  SHARE_UPLOAD_TTL_MS,
} from "@/lib/share-upload-db"
import {
  abortShareMultipartUpload,
  createShareMultipartUpload,
} from "@/lib/share-storage"
import {
  cleanupExpiredShareUploads,
  isShareUploadContentType,
  requireShareUploadUser,
  uploadStatusResponse,
} from "@/lib/share-upload-server"

export const runtime = "nodejs"

const MAX_SHARE_UPLOAD_BYTES = 1024 * 1024 * 1024

const createUploadSchema = z.object({
  contentType: z.enum(["video/mp4", "video/webm", "image/gif"]),
  sizeBytes: z.number().int().min(1).max(MAX_SHARE_UPLOAD_BYTES),
})

export async function POST(request: Request) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "share-upload-create",
    id: session.user.id,
  })
  if (limited) return limited

  let input: z.infer<typeof createUploadSchema>
  try {
    const parsed = createUploadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid upload request" },
        { status: 400 }
      )
    }
    input = parsed.data
  } catch {
    return NextResponse.json(
      { error: "Invalid upload request" },
      { status: 400 }
    )
  }

  if (!isShareUploadContentType(input.contentType)) {
    return NextResponse.json({ error: "Invalid media upload" }, { status: 400 })
  }

  await cleanupExpiredShareUploads().catch(() => {})
  const reservation = await canReserveShareUpload(
    session.user.id,
    input.sizeBytes
  )
  if (!reservation.allowed) {
    return NextResponse.json(
      {
        error: "Storage limit reached",
        storage: { used: reservation.used, limit: reservation.limit },
      },
      { status: 413 }
    )
  }

  const id = crypto.randomUUID()
  const shareId = crypto.randomUUID()
  if (!isValidShareId(id) || !isValidShareId(shareId)) {
    return NextResponse.json(
      { error: "Could not create upload" },
      { status: 500 }
    )
  }
  const objectKey = getShareObjectKey(shareId, input.contentType)

  let r2UploadId: string | null = null
  try {
    r2UploadId = await createShareMultipartUpload({
      id: shareId,
      uploadId: id,
      userId: session.user.id,
      contentType: input.contentType,
      objectKey,
    })
    const upload = await createShareUpload({
      id,
      shareId,
      userId: session.user.id,
      objectKey,
      r2UploadId,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    })
    if (!upload) {
      await abortShareMultipartUpload({ objectKey, r2UploadId }).catch(() => {})
      return NextResponse.json(
        {
          error: "Storage limit reached",
          storage: { used: reservation.used, limit: reservation.limit },
        },
        { status: 413 }
      )
    }
    return NextResponse.json({
      ...uploadStatusResponse(upload, 0, []),
      partSize: 8 * 1024 * 1024,
      expiresAt: new Date(Date.now() + SHARE_UPLOAD_TTL_MS).toISOString(),
    })
  } catch (error) {
    if (r2UploadId) {
      await abortShareMultipartUpload({ objectKey, r2UploadId }).catch(() => {})
    }
    console.error("Could not create share upload", error)
    return NextResponse.json(
      { error: "Could not start upload" },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response
  const id = new URL(request.url).searchParams.get("id")
  if (!id || !isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })
  }
  const upload = await getShareUploadForUser(id, session.user.id)
  if (!upload)
    return NextResponse.json({ error: "Upload not found" }, { status: 404 })
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
