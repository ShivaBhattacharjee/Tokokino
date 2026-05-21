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
 * grid. Full draft JSON state also lives in R2; D1 stores metadata and the
 * object keys.
 */

const MAX_DRAFT_THUMBNAIL_BYTES = 1 * 1024 * 1024
const MAX_DRAFT_STATE_BYTES = 15 * 1024 * 1024

export function getDraftThumbnailKey({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  return `drafts/${userId}/${id}-thumb.jpg`
}

export function getDraftStateKey({
  userId,
  id,
}: {
  userId: string
  id: string
}) {
  return `drafts/${userId}/${id}.json`
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

export async function uploadDraftState({
  userId,
  id,
  body,
}: {
  userId: string
  id: string
  body: Uint8Array
}) {
  if (body.byteLength > MAX_DRAFT_STATE_BYTES) {
    throw new Error("Draft state is too large")
  }
  const { bucket } = requireR2Config()
  const key = getDraftStateKey({ userId, id })
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      CacheControl: "private, max-age=0, no-store",
      Metadata: { userId },
    })
  )
  return key
}

export async function getDraftState({
  userId,
  id,
  stateKey,
}: {
  userId: string
  id: string
  stateKey: string
}) {
  const { bucket } = requireR2Config()
  return getR2Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: stateKey || getDraftStateKey({ userId, id }),
    })
  )
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

export async function deleteDraftState({
  userId,
  id,
  stateKey,
}: {
  userId: string
  id: string
  stateKey: string | null
}) {
  if (!stateKey) return
  const { bucket } = requireR2Config()
  await getR2Client()
    .send(new DeleteObjectCommand({ Bucket: bucket, Key: stateKey }))
    .catch((err: unknown) => {
      console.warn("Failed to remove draft state", { userId, id, err })
    })
}

export { MAX_DRAFT_STATE_BYTES, MAX_DRAFT_THUMBNAIL_BYTES }
