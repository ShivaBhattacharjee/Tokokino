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
  const [shares, storageUsed] = await Promise.all([
    getUserShares(session.user.id),
    getUserStorageUsage(session.user.id),
  ])
  return NextResponse.json({
    shares,
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

  const contentType = request.headers.get("content-type") ?? ""
  const normalizedType = contentType.toLowerCase()
  if (
    !normalizedType.startsWith("image/png") &&
    !normalizedType.startsWith("image/jpeg")
  ) {
    return NextResponse.json(
      { error: "Share upload must be a PNG or JPEG image" },
      { status: 415 }
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_SHARE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  }

  const image = new Uint8Array(await request.arrayBuffer())
  if (image.byteLength === 0) {
    return NextResponse.json({ error: "Missing image" }, { status: 400 })
  }
  if (image.byteLength > MAX_SHARE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  }

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
  const key = getShareObjectKey(id)

  try {
    await uploadShareImage({
      id,
      image,
      userId: session.user.id,
      contentType,
    })
    await createShareRecord({
      id,
      key,
      imageUrl,
      imageHash,
      sizeBytes: image.byteLength,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    })
  } catch (error) {
    console.error(error)
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
    views: 0,
    reused: false,
  })
}
