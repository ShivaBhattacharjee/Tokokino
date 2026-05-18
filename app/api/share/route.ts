import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { createShareRecord, findShareByImageHashForUser } from "@/lib/share-db"
import {
  getPublicShareImageUrl,
  getShareObjectKey,
  isValidShareId,
} from "@/lib/share"
import { MAX_SHARE_IMAGE_BYTES, uploadShareImage } from "@/lib/share-storage"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("image/png")) {
    return NextResponse.json(
      { error: "Share upload must be a PNG image" },
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
  const existingShare = await findShareByImageHashForUser({
    imageHash,
    userId: session.user.id,
  })

  if (existingShare) {
    const existingUrl = new URL(`/share/${existingShare.id}`, request.url)
    return NextResponse.json({
      id: existingShare.id,
      url: existingUrl.toString(),
      imageUrl: existingShare.imageUrl,
      views: existingShare.uniqueViewCount,
      reused: true,
    })
  }

  const id = crypto.randomUUID()
  if (!isValidShareId(id)) {
    return NextResponse.json(
      { error: "Could not create share id" },
      { status: 500 }
    )
  }
  const imageUrl = getPublicShareImageUrl(id)
  const key = getShareObjectKey(id)

  try {
    await uploadShareImage({
      id,
      image,
      userId: session.user.id,
    })
    await createShareRecord({
      id,
      key,
      imageUrl,
      imageHash,
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
