import { NextResponse } from "next/server"

import { isValidShareId } from "@/lib/share"
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
    const object = await getShareImage(id)
    const image = await object.Body?.transformToByteArray()

    if (!image) {
      return NextResponse.json({ error: "Share image not found" }, { status: 404 })
    }

    const body = new ArrayBuffer(image.byteLength)
    new Uint8Array(body).set(image)

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `attachment; filename="tokokino-share-${id}.png"`,
        "Content-Type": object.ContentType ?? "image/png",
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Share image not found" }, { status: 404 })
  }
}
