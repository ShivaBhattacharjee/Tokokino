import "server-only"

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"
import { getShareObjectKey } from "@/lib/share"

const MAX_SHARE_IMAGE_BYTES = 20 * 1024 * 1024

let client: S3Client | null = null

function getShareClient() {
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

export async function uploadShareImage({
  id,
  image,
  userId,
}: {
  id: string
  image: Uint8Array
  userId: string
}) {
  if (image.byteLength > MAX_SHARE_IMAGE_BYTES) {
    throw new Error("Share image is too large")
  }

  const { bucket } = requireR2Config()
  await getShareClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: getShareObjectKey(id),
      Body: image,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        userId,
      },
    })
  )
}

export async function getShareImage(id: string) {
  const { bucket } = requireR2Config()
  return getShareClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: getShareObjectKey(id),
    })
  )
}

export { MAX_SHARE_IMAGE_BYTES }
