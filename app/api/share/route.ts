import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"
import {
  createShareRecord,
  deleteAllUserShares,
  getUserShares,
  getUserStorageUsage,
  MAX_USER_SHARE_STORAGE_BYTES,
} from "@/lib/share-db"
import {
  getShareImageUrl,
  getShareObjectKey,
  isValidShareId,
} from "@/lib/share"
import {
  detectShareImageContentType,
  shareTypeForContentType,
} from "@/lib/share-image"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  deleteShareImage,
  deleteShareImages,
  MAX_SHARE_IMAGE_BYTES,
  uploadShareImage,
} from "@/lib/share-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }
  const url = new URL(request.url)
  const typeParam = url.searchParams.get("type")
  const type =
    typeParam === "animate" || typeParam === "style" ? typeParam : undefined

  const [shares, storageUsed] = await Promise.all([
    getUserShares(session.user.id, { type }),
    getUserStorageUsage(session.user.id),
  ])
  return NextResponse.json({
    shares: shares.map((s) => ({
      id: s.id,
      imageUrl: s.imageUrl,
      viewCount: s.viewCount,
      sizeBytes: s.sizeBytes,
      type: s.type,
      contentType: s.contentType,
      createdAt: s.createdAt,
    })),
    storage: { used: storageUsed, limit: MAX_USER_SHARE_STORAGE_BYTES },
  })
}

export async function DELETE(request: Request) {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }
  try {
    const ids = await deleteAllUserShares(session.user.id)
    await deleteShareImages(ids).catch(() => {})
    return NextResponse.json({ ok: true, deleted: ids.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not delete shares" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = getAuth()
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "share-create",
    id: session.user.id,
  })
  if (limited) return limited

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_SHARE_IMAGE_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 })
  }

  const image = new Uint8Array(await request.arrayBuffer())
  if (image.byteLength === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }
  if (image.byteLength > MAX_SHARE_IMAGE_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 })
  }

  const headerType = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]
    ?.trim()
  const detectedContentType = detectShareImageContentType(image)
  if (!detectedContentType) {
    return NextResponse.json(
      {
        error: "Share upload must be PNG, JPEG, GIF, MP4, or WebM",
      },
      { status: 415 }
    )
  }

  // Prefer sniffed type; allow matching header as a soft check.
  if (
    headerType &&
    headerType !== detectedContentType &&
    !(
      headerType.startsWith("image/") &&
      detectedContentType.startsWith("image/")
    )
  ) {
    // Still accept sniffed type — clients may send charset or codec params.
  }

  const contentType = detectedContentType
  const type = shareTypeForContentType(contentType)
  const imageHash = createHash("sha256").update(image).digest("hex")

  const storageUsed = await getUserStorageUsage(session.user.id)
  if (storageUsed + image.byteLength > MAX_USER_SHARE_STORAGE_BYTES) {
    return NextResponse.json(
      {
        error: "Storage limit reached",
        storage: {
          used: storageUsed,
          limit: MAX_USER_SHARE_STORAGE_BYTES,
        },
      },
      { status: 413 }
    )
  }

  const id = crypto.randomUUID()
  if (!isValidShareId(id)) {
    return NextResponse.json(
      { error: "Could not create share id" },
      { status: 500 }
    )
  }
  const imageUrl = getShareImageUrl(id, request.url)
  const key = getShareObjectKey(id, contentType)
  let uploaded = false

  try {
    await uploadShareImage({
      id,
      image,
      userId: session.user.id,
      contentType,
      objectKey: key,
    })
    uploaded = true
    await createShareRecord({
      id,
      key,
      imageUrl,
      imageHash,
      sizeBytes: image.byteLength,
      type,
      contentType,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    })
  } catch (error) {
    console.error(error)
    if (uploaded) {
      await deleteShareImage(id, key, contentType).catch((cleanupError) => {
        console.error("Could not clean up failed share upload", cleanupError)
      })
    }
    return NextResponse.json(
      { error: "Could not prepare share link" },
      { status: 500 }
    )
  }

  const url = new URL(`/share/${id}`, request.url)

  return NextResponse.json({
    id,
    url: url.toString(),
    imageUrl,
    type,
    contentType,
    views: 0,
    reused: false,
    storage: {
      used: storageUsed + image.byteLength,
      limit: MAX_USER_SHARE_STORAGE_BYTES,
    },
  })
}
