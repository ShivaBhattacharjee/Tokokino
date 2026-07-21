import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import { createCustomPreset, listCustomPresets } from "@/lib/preset-db"
import {
  MAX_PRESET_BYTES,
  createPresetBodySchema,
  presetListQuerySchema,
} from "@/lib/schemas/preset"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const { sort } = presetListQuerySchema.parse({
    sort: url.searchParams.get("sort") ?? undefined,
  })

  const presets = await listCustomPresets(auth.session.user.id, { sort })
  return NextResponse.json({
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      slotCount: preset.slotCount,
      type: preset.type,
      geometry: preset.geometry,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "preset-create",
    id: auth.session.user.id,
  })
  if (limited) return limited

  const body: unknown = await request.json().catch(() => null)
  const parsed = createPresetBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid preset payload" },
      { status: 400 }
    )
  }

  const type = parsed.data.type
  const rawGeometry = parsed.data.geometry

  if (type === "animate") {
    const clips = rawGeometry.animation?.clips
    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json(
        { error: "Animate presets require at least one timeline clip" },
        { status: 400 }
      )
    }
  }

  // Style presets must not carry a timeline payload.
  const geometry =
    type === "style"
      ? (() => {
          const { animation, ...rest } = rawGeometry
          void animation
          return rest
        })()
      : rawGeometry

  const serialized = JSON.stringify(geometry)
  if (new TextEncoder().encode(serialized).byteLength > MAX_PRESET_BYTES) {
    return NextResponse.json(
      { error: "Preset is too large to save" },
      { status: 413 }
    )
  }

  const id = crypto.randomUUID()
  const slotCount = geometry.slots.length + 1

  try {
    await createCustomPreset({
      id,
      userId: auth.session.user.id,
      name: parsed.data.name,
      slotCount,
      type,
      geometry,
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
      type,
      geometry,
    },
  })
}
