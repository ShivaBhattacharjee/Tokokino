import "server-only"

import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"
import { getR2Client } from "@/lib/r2-client"
import { getShareObjectKey } from "@/lib/share"

const MAX_SHARE_IMAGE_BYTES = 20 * 1024 * 1024

export async function uploadShareImage({
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
  if (image.byteLength > MAX_SHARE_IMAGE_BYTES) {
    throw new Error("Share image is too large")
  }

  const { bucket } = requireR2Config()
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: getShareObjectKey(id),
      Body: image,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        userId,
      },
    })
  )
}

export async function getShareImage(id: string) {
  const { bucket } = requireR2Config()
  return getR2Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: getShareObjectKey(id),
    })
  )
}

export { MAX_SHARE_IMAGE_BYTES }
