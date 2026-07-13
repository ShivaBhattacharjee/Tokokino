import { NextResponse } from "next/server"

import { setSharePosterKey } from "@/lib/share-db"
import { getShareUploadForUser } from "@/lib/share-upload-db"
import { detectShareImageContentType } from "@/lib/share-image"
import { uploadSharePoster, MAX_SHARE_POSTER_BYTES } from "@/lib/share-storage"
import { requireShareUploadUser } from "@/lib/share-upload-server"
import { isValidShareId } from "@/lib/share"

export const runtime = "nodejs"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireShareUploadUser(request)
  if (!session) return response
  const { id } = await params
  if (!isValidShareId(id))
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 })
  const upload = await getShareUploadForUser(id, session.user.id)
  if (!upload || upload.status !== "complete") {
    return NextResponse.json(
      { error: "Completed upload not found" },
      { status: 404 }
    )
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  const contentType = detectShareImageContentType(bytes)
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_SHARE_POSTER_BYTES ||
    (contentType !== "image/png" && contentType !== "image/jpeg")
  ) {
    return NextResponse.json(
      { error: "Poster must be a PNG or JPEG" },
      { status: 400 }
    )
  }
  try {
    const posterKey = await uploadSharePoster({
      id: upload.shareId,
      image: bytes,
      userId: session.user.id,
      contentType,
    })
    await setSharePosterKey(upload.shareId, session.user.id, posterKey)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Could not upload share poster", error)
    return NextResponse.json(
      { error: "Could not upload poster" },
      { status: 502 }
    )
  }
}
