import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import {
  createCustomPreset,
  listCustomPresets,
} from "@/lib/preset-db"
import {
  MAX_PRESET_BYTES,
  createPresetBodySchema,
} from "@/lib/schemas/preset"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const presets = await listCustomPresets(auth.session.user.id)
  return NextResponse.json({
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      slotCount: preset.slotCount,
      geometry: preset.geometry,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const body: unknown = await request.json().catch(() => null)
  const parsed = createPresetBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid preset payload" },
      { status: 400 }
    )
  }

  const serialized = JSON.stringify(parsed.data.geometry)
  if (new TextEncoder().encode(serialized).byteLength > MAX_PRESET_BYTES) {
    return NextResponse.json(
      { error: "Preset is too large to save" },
      { status: 413 }
    )
  }

  const id = crypto.randomUUID()
  const slotCount = parsed.data.geometry.slots.length + 1

  try {
    await createCustomPreset({
      id,
      userId: auth.session.user.id,
      name: parsed.data.name,
      slotCount,
      geometry: parsed.data.geometry,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not save preset" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    preset: {
      id,
      name: parsed.data.name,
      slotCount,
      geometry: parsed.data.geometry,
    },
  })
}
