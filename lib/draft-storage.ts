import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"
import { getR2Client } from "@/lib/r2-client"

/**
 * R2-backed storage for the *thumbnails* that appear in the Open Project
 * grid. The actual draft JSON state lives in MongoDB (see {@link
 * "@/lib/draft-db".DraftRecord.state}) — R2 here is image-only.
 */

const MAX_DRAFT_THUMBNAIL_BYTES = 1 * 1024 * 1024

export function getDraftThumbnailKey({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  return `drafts/${userId}/${id}-thumb.jpg`
}

export async function uploadDraftThumbnail({
  userId,
  id,
  body,
  contentType,
}: {
  userId: string
  id: string
  body: Uint8Array
  contentType: string
}) {
  if (body.byteLength > MAX_DRAFT_THUMBNAIL_BYTES) {
    throw new Error("Draft thumbnail is too large")
  }
  const { bucket } = requireR2Config()
  const key = getDraftThumbnailKey({ userId, id })
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=0, no-store",
      Metadata: { userId },
    })
  )
  return key
}

export async function getDraftThumbnail({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  const { bucket } = requireR2Config()
  return getR2Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: getDraftThumbnailKey({ userId, id }),
    })
  )
}

export async function deleteDraftThumbnail({
  userId,
  id,
  thumbnailKey,
}: {
  userId: string
  id: string
  thumbnailKey: string | null
}) {
  if (!thumbnailKey) return
  const { bucket } = requireR2Config()
  await getR2Client()
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbnailKey }))
    .catch((err: unknown) => {
      console.warn("Failed to remove draft thumbnail", { userId, id, err })
    })
}

export { MAX_DRAFT_THUMBNAIL_BYTES }
