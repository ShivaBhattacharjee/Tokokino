import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  deleteCustomPreset,
  getCustomPreset,
  updateCustomPreset,
} from "@/lib/preset-db"
import {
  MAX_PRESET_BYTES,
  updatePresetBodySchema,
  type CustomPresetType,
} from "@/lib/schemas/preset"
import type { StoredPresetGeometry } from "@/lib/db/schema"

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

  const raw: unknown = await request.json().catch(() => null)
  const parsed = updatePresetBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid preset payload" },
      { status: 400 }
    )
  }

  const name = parsed.data.name ?? existing.name
  const type: CustomPresetType = parsed.data.type ?? existing.type
  let geometry: StoredPresetGeometry =
    (parsed.data.geometry as StoredPresetGeometry | undefined) ??
    existing.geometry

  if (type === "style") {
    const { animation, ...rest } = geometry
    void animation
    geometry = rest
  } else {
    const clips = geometry.animation?.clips
    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json(
        { error: "Animate presets require at least one timeline clip" },
        { status: 400 }
      )
    }
  }

  const serialized = JSON.stringify(geometry)
  if (new TextEncoder().encode(serialized).byteLength > MAX_PRESET_BYTES) {
    return NextResponse.json(
      { error: "Preset is too large to save" },
      { status: 413 }
    )
  }

  const slotCount = Array.isArray(geometry.slots)
    ? geometry.slots.length + 1
    : existing.slotCount

  try {
    await updateCustomPreset({
      id,
      userId: auth.session.user.id,
      name,
      slotCount,
      type,
      geometry,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not update preset" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    preset: {
      id,
      name,
      slotCount,
      type,
      geometry,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    },
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
