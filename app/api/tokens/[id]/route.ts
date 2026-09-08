import { NextResponse } from "next/server"

import { requireSession } from "@/lib/api-auth"
import { deletePersonalAccessToken } from "@/lib/personal-access-tokens"
import { enforceRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "pat-revoke",
    id: auth.session.user.id,
  })
  if (limited) return limited

  const { id } = await params
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 })
  }

  const deleted = await deletePersonalAccessToken(id, auth.session.user.id)
  if (!deleted) {
    // 404 either way so token ids can't be probed across accounts.
    return NextResponse.json({ error: "Token not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
