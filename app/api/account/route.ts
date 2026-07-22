import { NextResponse } from "next/server"
import { z } from "zod/v4"

import {
  requestAccountDeletion,
  retryPendingAccountCleanups,
} from "@/lib/account-management"
import { requireSession } from "@/lib/api-auth"
import { getAuth } from "@/lib/auth"
import { getD1Database } from "@/lib/d1"
import { enforceRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

const sessionActionSchema = z
  .object({
    action: z.enum(["revoke", "revoke-all"]),
    sessionId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "revoke" && !value.sessionId) {
      ctx.addIssue({ code: "custom", message: "A session is required" })
    }
  })

const deleteAccountSchema = z.object({ confirmation: z.literal("DELETE") })

type CloudflareRequest = Request & {
  cf?: { city?: string; region?: string; country?: string }
}

function sessionLocation(request: Request) {
  const cf = (request as CloudflareRequest).cf
  if (!cf) return null
  const parts = [cf.city, cf.region || cf.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

function deviceName(userAgent: string | null | undefined) {
  const agent = userAgent ?? ""
  const browser = /edg\//i.test(agent)
    ? "Edge"
    : /firefox\//i.test(agent)
      ? "Firefox"
      : /chrome\//i.test(agent)
        ? "Chrome"
        : /safari\//i.test(agent)
          ? "Safari"
          : "Browser"
  const platform = /iphone/i.test(agent)
    ? "iPhone"
    : /ipad/i.test(agent)
      ? "iPad"
      : /android/i.test(agent)
        ? "Android"
        : /macintosh|mac os/i.test(agent)
          ? "macOS"
          : /windows/i.test(agent)
            ? "Windows"
            : /linux/i.test(agent)
              ? "Linux"
              : "Unknown device"
  return `${browser} on ${platform}`
}

export async function GET(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const current = auth.session

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "account-sessions",
    id: current.user.id,
  })
  if (limited) return limited

  // Fire-and-forget so the route stays non-blocking, but attach a handler so a
  // failure in the initial query can't surface as an unhandled rejection.
  void retryPendingAccountCleanups().catch((error) => {
    console.error("Could not retry pending account cleanups", error)
  })

  const location = sessionLocation(request)
  if (location) {
    await getD1Database()
      .prepare(
        "INSERT INTO session_locations (session_id, location, updated_at) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET location = excluded.location, updated_at = excluded.updated_at"
      )
      .bind(current.session.id, location, new Date().toISOString())
      .run()
  }

  const sessions = await getAuth().api.listSessions({
    headers: request.headers,
  })
  const locationBySession = new Map<string, string>()
  if (sessions.length > 0) {
    const placeholders = sessions.map(() => "?").join(", ")
    const rows = await getD1Database()
      .prepare(
        `SELECT session_id, location FROM session_locations WHERE session_id IN (${placeholders})`
      )
      .bind(...sessions.map((session) => session.id))
      .all<{ session_id: string; location: string }>()
    for (const row of rows.results ?? []) {
      locationBySession.set(row.session_id, row.location)
    }
  }

  return NextResponse.json({
    sessions: sessions
      .map((session) => ({
        id: session.id,
        device: deviceName(session.userAgent),
        location: locationBySession.get(session.id) ?? "Location unavailable",
        lastActive: session.updatedAt.toISOString(),
        current: session.id === current.session.id,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current)),
  })
}

export async function POST(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const current = auth.session

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "account-session-revoke",
    id: current.user.id,
  })
  if (limited) return limited

  const input = sessionActionSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!input.success) {
    return NextResponse.json(
      { error: "Invalid session action" },
      { status: 400 }
    )
  }

  if (input.data.action === "revoke-all") {
    await getAuth().api.revokeSessions({ headers: request.headers })
    return NextResponse.json({ ok: true, current: true })
  }

  const sessions = await getAuth().api.listSessions({
    headers: request.headers,
  })
  const target = sessions.find((session) => session.id === input.data.sessionId)
  if (!target)
    return NextResponse.json({ error: "Session not found" }, { status: 404 })

  await getAuth().api.revokeSession({
    headers: request.headers,
    body: { token: target.token },
  })
  return NextResponse.json({
    ok: true,
    current: target.id === current.session.id,
  })
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request)
  if (!auth.ok) return auth.response
  const current = auth.session

  const limited = await enforceRateLimit({
    limiter: "WRITE_RATE_LIMITER",
    scope: "account-delete",
    id: current.user.id,
  })
  if (limited) return limited

  const input = deleteAccountSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!input.success) {
    return NextResponse.json(
      { error: "Type DELETE to permanently delete your account" },
      { status: 400 }
    )
  }

  // Sign the user out everywhere, then hand the heavy deletion to the queue.
  // Re-login is blocked by the account-deletion gate in `lib/auth.ts`.
  await getAuth().api.revokeSessions({ headers: request.headers })
  await requestAccountDeletion(current.user.id)
  return NextResponse.json({ ok: true, status: "pending" })
}
