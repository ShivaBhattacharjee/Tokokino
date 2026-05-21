import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { deleteCustomPreset, getCustomPreset, updateCustomPreset } from "@/lib/preset-db"

export const runtime = "nodejs"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing preset id" }, { status: 400 })
  }

  const existing = await getCustomPreset({ id, userId: auth.session.user.id })
  if (!existing) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 })
  }

  let body: { name?: string; geometry?: unknown }
  try {
    body = (await request.json())
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name
  const geometry = body.geometry ?? existing.geometry

  try {
    await updateCustomPreset({
      id,
      userId: auth.session.user.id,
      name,
      slotCount: Array.isArray((geometry as { slots?: unknown[] }).slots)
        ? ((geometry as { slots: unknown[] }).slots.length)
        : existing.slotCount,
      geometry: geometry as Parameters<typeof updateCustomPreset>[0]["geometry"],
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Could not update preset" }, { status: 500 })
  }

  return NextResponse.json({
    preset: { id, name, slotCount: existing.slotCount, createdAt: existing.createdAt },
  })
}

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

  try {
    const result = await deleteCustomPreset({
      id,
      userId: auth.session.user.id,
    })
    if (result.meta.changes === 0) {
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
