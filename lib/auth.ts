import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"

import { isAccountDeletionPending } from "@/lib/account-deletion"
import { getD1Database } from "@/lib/d1"
import { env, requireAuthConfig } from "@/lib/env"

function createAuth() {
  const authConfig = requireAuthConfig()

  return betterAuth({
    baseURL: authConfig.baseURL,
    secret: authConfig.secret,
    database: getD1Database(),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    rateLimit: {
      // Persist counters in D1 so limits hold across Workers isolates instead
      // of the default per-isolate in-memory store.
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/forget-password": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Block sign-in for accounts queued for deletion. The user row still
          // exists until the queue consumer finishes, so this closes the window
          // where someone could re-authenticate mid-deletion.
          before: async (session, ctx) => {
            if (!(await isAccountDeletionPending(session.userId))) {
              return { data: session }
            }

            const message =
              "This account is being deleted and can no longer be accessed."

            // OAuth logins finish on a `/callback` (or `/oauth2/callback`)
            // route mid-redirect — a plain APIError does not abort that flow, so
            // we redirect instead (mirrors better-auth's own banned-user gate).
            if (
              ctx &&
              (ctx.path.startsWith("/callback") ||
                ctx.path.startsWith("/oauth2/callback"))
            ) {
              // An absolute "/login" path resolves against the origin whether or
              // not `baseURL` carries the `/api/auth` suffix.
              const target = ctx.context.options.onAPIError?.errorURL
                ? new URL(ctx.context.options.onAPIError.errorURL)
                : new URL("/login", ctx.context.baseURL)
              target.searchParams.set("error", "account_deleted")
              throw ctx.redirect(target.toString())
            }

            throw new APIError("FORBIDDEN", { message })
          },
        },
      },
    },
    plugins: [nextCookies()],
  })
}

let authInstance: ReturnType<typeof createAuth> | null = null

export function getAuth() {
  authInstance ??= createAuth()
  return authInstance
}
