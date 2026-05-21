import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"

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
    plugins: [nextCookies()],
  })
}

let authInstance: ReturnType<typeof createAuth> | null = null

export function getAuth() {
  authInstance ??= createAuth()
  return authInstance
}
