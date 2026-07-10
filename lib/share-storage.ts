import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"
import { getR2Client } from "@/lib/r2-client"
import {
  getLegacyShareObjectKey,
  getShareObjectKey,
  getSharePosterObjectKey,
} from "@/lib/share"

/** Cap per share payload (images + short animations). */
const MAX_SHARE_IMAGE_BYTES = 40 * 1024 * 1024

/** Poster still-frames are small; keep them well under the payload cap. */
const MAX_SHARE_POSTER_BYTES = 4 * 1024 * 1024

export async function uploadShareImage({
  id,
  image,
  userId,
  contentType = "image/png",
  objectKey,
}: {
  id: string
  image: Uint8Array
  userId: string
  contentType?: string
  /** When provided (from D1), write to this exact key. */
  objectKey?: string
}) {
  if (image.byteLength > MAX_SHARE_IMAGE_BYTES) {
    throw new Error("Share file is too large")
  }

  const key = objectKey ?? getShareObjectKey(id, contentType)
  const { bucket } = requireR2Config()
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: image,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        userId,
      },
    })
  )
  return key
}

export async function uploadSharePoster({
  id,
  image,
  userId,
  contentType = "image/png",
}: {
  id: string
  image: Uint8Array
  userId: string
  contentType?: string
}) {
  if (image.byteLength > MAX_SHARE_POSTER_BYTES) {
    throw new Error("Share poster is too large")
  }
  const key = getSharePosterObjectKey(id)
  const { bucket } = requireR2Config()
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: image,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        userId,
      },
    })
  )
  return key
}

export async function getSharePoster(id: string, posterKey?: string | null) {
  const { bucket } = requireR2Config()
  return getR2Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: posterKey || getSharePosterObjectKey(id),
    })
  )
}

export async function getShareImage(
  id: string,
  objectKey?: string | null,
  contentType?: string | null
) {
  const { bucket } = requireR2Config()
  const keys = [
    objectKey,
    contentType ? getShareObjectKey(id, contentType) : null,
    getLegacyShareObjectKey(id),
    getShareObjectKey(id, "video/mp4"),
    getShareObjectKey(id, "video/webm"),
    getShareObjectKey(id, "image/gif"),
  ].filter((k): k is string => Boolean(k))

  // De-dupe while preserving order.
  const tried = new Set<string>()
  let lastError: unknown = null
  for (const key of keys) {
    if (tried.has(key)) continue
    tried.add(key)
    try {
      return await getR2Client().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      )
    } catch (error) {
      lastError = error
    }
  }
  if (lastError instanceof Error) throw lastError
  throw new Error("Share media not found")
}

export async function deleteShareImage(
  id: string,
  objectKey?: string | null,
  contentType?: string | null
) {
  const { bucket } = requireR2Config()
  const keys = [
    objectKey,
    contentType ? getShareObjectKey(id, contentType) : null,
    getLegacyShareObjectKey(id),
    getShareObjectKey(id, "video/mp4"),
    getShareObjectKey(id, "video/webm"),
    getShareObjectKey(id, "image/gif"),
    // Best-effort: animate shares may also have a poster still-frame.
    getSharePosterObjectKey(id),
  ].filter((k): k is string => Boolean(k))

  const unique = [...new Set(keys)]
  await Promise.allSettled(
    unique.map((key) =>
      getR2Client().send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      )
    )
  )
}

export async function deleteShareImages(ids: string[]) {
  await Promise.allSettled(ids.map((id) => deleteShareImage(id)))
}

export { MAX_SHARE_IMAGE_BYTES, MAX_SHARE_POSTER_BYTES }
