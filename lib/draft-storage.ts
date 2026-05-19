import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"

/**
 * R2-backed storage for the *thumbnails* that appear in the Open Project
 * grid. The actual draft JSON state lives in MongoDB (see {@link
 * "@/lib/draft-db".DraftRecord.state}) — R2 here is image-only.
 */

const MAX_DRAFT_THUMBNAIL_BYTES = 1 * 1024 * 1024

let client: S3Client | null = null

function getDraftClient() {
  if (client) return client
  const config = requireR2Config()
  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return client
}

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
  await getDraftClient().send(
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
  return getDraftClient().send(
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
  await getDraftClient()
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: thumbnailKey }))
    .catch((err) => {
      // Best-effort: a missing thumbnail shouldn't fail the user's delete.
      console.warn("Failed to remove draft thumbnail", { userId, id, err })
    })
}

export { MAX_DRAFT_THUMBNAIL_BYTES }
