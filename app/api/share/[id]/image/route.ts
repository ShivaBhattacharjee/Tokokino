import { NextResponse } from "next/server"

import { isValidShareId, extensionForShareContentType } from "@/lib/share"
import { getShareById } from "@/lib/share-db"
import { getShareImage } from "@/lib/share-storage"

export const runtime = "nodejs"

export async function GET(
  request: Request,
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
    const object = await getShareImage(
      id,
      meta?.key,
      meta?.contentType,
      request.headers.get("range")
    )
    const body = object.Body?.transformToWebStream()

    if (!body) {
      return NextResponse.json(
        { error: "Share media not found" },
        { status: 404 }
      )
    }

    const contentType = object.ContentType ?? meta?.contentType ?? "image/png"
    const ext = extensionForShareContentType(contentType)

    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="tokokino-share-${id}.${ext}"`,
      "Content-Type": contentType,
      "Content-Length": String(object.ContentLength ?? ""),
      "Accept-Ranges": "bytes",
    })
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange)
    return new NextResponse(body, {
      status: object.ContentRange ? 206 : 200,
      headers,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Share media not found" },
      { status: 404 }
    )
  }
}
