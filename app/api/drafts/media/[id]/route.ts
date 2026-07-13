import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { getDraftMedia } from "@/lib/draft-media-db"
import { getDraftMedia as getDraftMediaObject } from "@/lib/draft-storage"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params
  const media = await getDraftMedia(id, auth.session.user.id)
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 })
  try {
    const object = await getDraftMediaObject(
      media.objectKey,
      request.headers.get("range")
    )
    const body = object.Body?.transformToWebStream()
    if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const headers = new Headers({
      "Content-Type": media.contentType,
      "Content-Length": String(object.ContentLength ?? media.sizeBytes),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    })
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange)
    return new NextResponse(body, {
      status: object.ContentRange ? 206 : 200,
      headers,
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
