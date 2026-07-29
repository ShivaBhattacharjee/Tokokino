"use client"

import * as React from "react"

import { capture, identifyUser } from "@/lib/analytics"
import { useSession } from "@/lib/auth-client"

/**
 * Marks that a sign-in redirect is in flight. Google OAuth navigates away and
 * back, so the return leg is the only place completion can be observed — but a
 * returning user with a live session lands on the same route, and counting that
 * as a completion would inflate the funnel. The flag distinguishes the two.
 */
const SIGN_IN_PENDING_KEY = "tokokino:sign-in-pending"

export function markSignInPending(): void {
  try {
    sessionStorage.setItem(SIGN_IN_PENDING_KEY, "1")
  } catch {
    // Private mode / storage disabled — completion just goes unrecorded.
  }
}

/** Clear on a failed attempt, so it cannot fire a completion for a later visit. */
export function clearSignInPending(): void {
  try {
    sessionStorage.removeItem(SIGN_IN_PENDING_KEY)
  } catch {
    // Nothing was stored either.
  }
}

function consumeSignInPending(): boolean {
  try {
    if (sessionStorage.getItem(SIGN_IN_PENDING_KEY) !== "1") return false
    sessionStorage.removeItem(SIGN_IN_PENDING_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * Attaches the signed-in user to their PostHog person profile.
 *
 * Mounted on the authenticated surface rather than the root layout on purpose:
 * `useSession` costs a `/api/auth/get-session` round trip, and adding one to
 * every marketing and public-share pageview would mean a Worker invocation per
 * visit to pay for analytics. Anonymous events on those pages still merge into
 * the person automatically once the user identifies here.
 */
export function AnalyticsIdentity() {
  const { data: session } = useSession()
  const userId = session?.user?.id

  React.useEffect(() => {
    if (!userId) return
    identifyUser({
      id: userId,
      email: session?.user?.email,
      name: session?.user?.name,
      createdAt: session?.user?.createdAt,
    })
    if (consumeSignInPending()) {
      capture("sign_in_completed", { provider: "google" })
    }
  }, [
    userId,
    session?.user?.email,
    session?.user?.name,
    session?.user?.createdAt,
  ])

  return null
}
