import { createAuthClient } from "better-auth/react"

import { capture, resetAnalytics } from "@/lib/analytics"

export const authClient = createAuthClient()

export const { signIn, signUp, useSession } = authClient

/**
 * Wrapped rather than re-exported so no sign-out path can forget the analytics
 * reset — leaving the distinct_id in place merges the next user on a shared
 * device into this user's person profile, rewriting past events too.
 *
 * Callers that reach for `authClient.signOut` directly bypass this; use the
 * named export.
 */
export const signOut: typeof authClient.signOut = async (...args) => {
  capture("signed_out")
  try {
    return await authClient.signOut(...args)
  } finally {
    resetAnalytics()
  }
}
