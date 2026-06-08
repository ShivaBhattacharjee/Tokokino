import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import { updatePreferencesBodySchema } from "@/lib/schemas/preferences"
import {
  getUserPreferences,
  setExportFilenameFormatPreference,
} from "@/lib/user-preferences-db"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const preferences = await getUserPreferences(auth.session.user.id)
  return NextResponse.json({
    exportFilenameFormat: preferences?.exportFilenameFormat ?? null,
  })
}

export async function PUT(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "preferences-update",
    id: auth.session.user.id,
  })
  if (limited) return limited

  const body: unknown = await request.json().catch(() => null)
  const parsed = updatePreferencesBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid preferences payload",
      },
      { status: 400 }
    )
  }

  const exportFilenameFormat = parsed.data.exportFilenameFormat || null

  try {
    await setExportFilenameFormatPreference({
      userId: auth.session.user.id,
      exportFilenameFormat,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Could not save preferences" },
      { status: 500 }
    )
  }

  return NextResponse.json({ exportFilenameFormat })
}
