import "server-only"

import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"
import { getShareById } from "@/lib/share-db"
import {
  getExpiredShareUploads,
  markShareUploadComplete,
  setShareUploadCancelled,
  type ShareUpload,
} from "@/lib/share-upload-db"
import { abortShareMultipartUpload } from "@/lib/share-storage"

export const SHARE_UPLOAD_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "image/gif",
] as const

export type ShareUploadContentType = (typeof SHARE_UPLOAD_CONTENT_TYPES)[number]

export function isShareUploadContentType(
  value: unknown
): value is ShareUploadContentType {
  return (
    typeof value === "string" &&
    (SHARE_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value)
  )
}

export async function requireShareUploadUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Sign in required" },
        { status: 401 }
      ),
    }
  }
  return { session, response: null }
}

/** Best-effort cleanup. A cancelled session releases its quota immediately. */
export async function cleanupExpiredShareUploads() {
  const uploads = await getExpiredShareUploads()
  await Promise.allSettled(
    uploads.map(async (upload) => {
      // A request can die after the public record commit but before its session
      // is marked complete. Keep that completed share intact during cleanup.
      if (await getShareById(upload.shareId)) {
        await markShareUploadComplete(upload.id, upload.userId)
        return
      }
      await abortShareMultipartUpload({
        objectKey: upload.objectKey,
        r2UploadId: upload.r2UploadId,
      }).catch(() => {})
      await setShareUploadCancelled(upload.id)
    })
  )
}

export function uploadStatusResponse(
  upload: ShareUpload,
  confirmedBytes: number,
  parts: number[]
) {
  return {
    id: upload.id,
    shareId: upload.shareId,
    status: upload.status,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    confirmedBytes,
    parts,
    expiresAt: upload.expiresAt.toISOString(),
    url: upload.status === "complete" ? `/share/${upload.shareId}` : null,
  }
}
