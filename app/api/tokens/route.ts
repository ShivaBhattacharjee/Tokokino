import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { requireSession } from "@/lib/api-auth"
import {
  countActivePersonalAccessTokens,
  createPersonalAccessTokenRecord,
  deletePersonalAccessToken,
  generatePersonalAccessToken,
  hashPersonalAccessToken,
  listPersonalAccessTokens,
  MAX_TOKENS_PER_USER,
  patNameSchema,
  tokenPrefixDisplay,
} from "@/lib/personal-access-tokens"
import { enforceRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const createTokenSchema = z.object({
  name: patNameSchema,
  /** Optional expiry as an ISO-8601 timestamp. Must be in the future. */
  expiresAt: z.iso.datetime().nullable().optional(),
})

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const tokens = await listPersonalAccessTokens(auth.session.user.id)
  return NextResponse.json({ tokens })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "pat-create",
    id: auth.session.user.id,
  })
  if (limited) return limited

  const parsed = createTokenSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid token request",
        detail: parsed.error.issues[0]?.message ?? "Invalid body",
      },
      { status: 400 }
    )
  }

  const existing = await countActivePersonalAccessTokens(auth.session.user.id)
  if (existing >= MAX_TOKENS_PER_USER) {
    return NextResponse.json(
      {
        error: `Token limit reached (${MAX_TOKENS_PER_USER}). Revoke an unused token first.`,
      },
      { status: 409 }
    )
  }

  let expiresAt: string | null = null
  if (parsed.data.expiresAt) {
    const time = new Date(parsed.data.expiresAt).getTime()
    if (!Number.isFinite(time) || time <= Date.now()) {
      return NextResponse.json(
        { error: "Expiry must be a future date" },
        { status: 400 }
      )
    }
    expiresAt = new Date(time).toISOString()
  }

  const token = generatePersonalAccessToken()
  const record = await createPersonalAccessTokenRecord({
    id: crypto.randomUUID(),
    userId: auth.session.user.id,
    name: parsed.data.name,
    tokenHash: hashPersonalAccessToken(token),
    prefix: tokenPrefixDisplay(token),
    expiresAt,
  })

  // The pre-insert count can race with concurrent creations (D1 offers no
  // serializable transaction here), so verify the cap after inserting and
  // roll our own row back when we overflowed. Every concurrent creator does
  // the same check, so the account converges back at or under the cap while
  // only the overflowed requests fail.
  const active = await countActivePersonalAccessTokens(auth.session.user.id)
  if (active > MAX_TOKENS_PER_USER) {
    await deletePersonalAccessToken(record.id, auth.session.user.id).catch(
      () => {}
    )
    return NextResponse.json(
      {
        error: `Token limit reached (${MAX_TOKENS_PER_USER}). Revoke an unused token first.`,
      },
      { status: 409 }
    )
  }

  // The plaintext token is returned exactly once — it is stored only as a
  // SHA-256 hash and can never be read back.
  return NextResponse.json({ token, ...record })
}
