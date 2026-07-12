import { NextResponse } from "next/server"

import { isValidShareId, extensionForShareContentType } from "@/lib/share"
import { getShareById } from "@/lib/share-db"
import { getShareImage } from "@/lib/share-storage"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid share link" }, { status: 400 })
  }

  try {
    const meta = await getShareById(id).catch(() => null)
    if (!meta) {
      return NextResponse.json(
        { error: "Share media not found" },
        { status: 404 }
      )
    }
    const object = await getShareImage(id, meta?.key, meta?.contentType)
    const body = object.Body?.transformToWebStream()

    if (!body) {
      return NextResponse.json(
        { error: "Share media not found" },
        { status: 404 }
      )
    }

    const contentType = object.ContentType ?? meta?.contentType ?? "image/png"
    const ext = extensionForShareContentType(contentType)

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="tokokino-share-${id}.${ext}"`,
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Share media not found" },
      { status: 404 }
    )
  }
}
