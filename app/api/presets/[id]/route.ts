import { NextResponse } from "next/server"

import { assertOwner, requireSession } from "@/lib/api-auth"
import { deleteCustomPreset, getCustomPresetById } from "@/lib/preset-db"

export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing preset id" }, { status: 400 })
  }

  const existing = await getCustomPresetById(id)
  const ownership = assertOwner({
    session: auth.session,
    ownerId: existing?.userId,
  })
  if (ownership || !existing) {
    return ownership ?? NextResponse.json({ error: "Preset not found" }, { status: 404 })
  }

  try {
    const result = await deleteCustomPreset({
      id,
      userId: auth.session.user.id,
    })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not delete preset" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
