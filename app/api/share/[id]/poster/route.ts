import { NextResponse } from "next/server"

import { isValidShareId } from "@/lib/share"
import { getShareById } from "@/lib/share-db"
import { getSharePoster } from "@/lib/share-storage"

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
    if (!meta?.posterKey) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 })
    }
    const object = await getSharePoster(id, meta?.posterKey)
    const body = object.Body?.transformToWebStream()

    if (!body) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 })
    }

    const contentType = object.ContentType ?? "image/png"

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="tokokino-share-${id}-poster.png"`,
        "Content-Type": contentType,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Poster not found" }, { status: 404 })
  }
}
