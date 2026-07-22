import "server-only"

import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"

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
