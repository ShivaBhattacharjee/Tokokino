import "server-only"

import { PutObjectCommand } from "@aws-sdk/client-s3"

import { requireR2Config } from "@/lib/env"
import { getR2Client } from "@/lib/r2-client"

/** Template posters/preview clips are small; keep them well under 8 MB. */
export const MAX_TEMPLATE_ASSET_BYTES = 8 * 1024 * 1024

const PUBLIC_BASE = "https://assets.tokokino.com"

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/webm": "webm",
  "video/mp4": "mp4",
}

export function templateAssetExt(contentType: string): string | null {
  return EXT_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? null
}

export function templateAssetKey(slug: string, ext: string): string {
  return `templates/${slug}.${ext}`
}

export function templateAssetPublicUrl(key: string): string {
  return `${PUBLIC_BASE}/${key}`
}

/**
 * Publish a curated template asset (poster or preview clip) to R2 under a
 * stable, slug-derived key so the catalogue can reference a permanent public
 * URL. Overwrites any existing asset at the same key — re-authoring a template
 * refreshes its poster in place.
 */
export async function uploadTemplateAsset({
  slug,
  body,
  contentType,
}: {
  slug: string
  body: Uint8Array
  contentType: string
}): Promise<{ key: string; url: string }> {
  if (body.byteLength > MAX_TEMPLATE_ASSET_BYTES) {
    throw new Error("Template asset is too large")
  }
  const ext = templateAssetExt(contentType)
  if (!ext) {
    throw new Error("Unsupported template asset type")
  }

  const key = templateAssetKey(slug, ext)
  const { bucket } = requireR2Config()
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return { key, url: templateAssetPublicUrl(key) }
}
