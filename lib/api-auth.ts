import "server-only"

import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"
import { env } from "@/lib/env"

export type AuthorizedSession = {
  session: {
    id: string
  }
  user: {
    id: string
    name?: string | null
    email?: string | null
  }
}

export async function requireSession(
  request: Request
): Promise<
  | { ok: true; session: AuthorizedSession }
  | { ok: false; response: NextResponse }
> {
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in required" },
        { status: 401 }
      ),
    }
  }
  return { ok: true, session }
}

/**
 * Session must belong to a maintainer email listed in
 * TEMPLATE_MAINTAINER_EMAILS. Fail closed when the allowlist is empty.
 */
export function assertTemplateMaintainer(
  session: AuthorizedSession
): NextResponse | null {
  const email = session.user.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const allowed = (env.TEMPLATE_MAINTAINER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/**
 * Verifies that an entity owned by `userId` belongs to the current session.
 * Returns null on success. Returns a NextResponse on failure that the route
 * should immediately return.
 *
 * Note: We deliberately return 404 (not 403) when ownership fails so we don't
 * leak whether a given id exists in another user's account.
 */
export function assertOwner({
  session,
  ownerId,
}: {
  session: AuthorizedSession
  ownerId: string | null | undefined
}): NextResponse | null {
  if (!ownerId || ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return null
}
