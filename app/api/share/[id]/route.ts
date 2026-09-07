import { NextResponse } from "next/server"

import { resolveApiSession } from "@/lib/api-auth"
import { deleteShareRecord } from "@/lib/share-db"
import { isValidShareId } from "@/lib/share"
import { deleteShareImage } from "@/lib/share-storage"

export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await resolveApiSession(request)
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const { id } = await params
  if (!isValidShareId(id)) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 })
  }

  try {
    await deleteShareRecord(id, session.user.id)
    await deleteShareImage(id).catch(() => {
      // R2 deletion failure is non-fatal — DB record is already gone
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not delete share" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
