import { z } from "zod/v4"

/**
 * Schema for server-side environment variables.
 * These are only available in server components and API routes.
 */
const serverSchema = z.object({
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_S3_ENDPOINT: z.url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_API_TOKEN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_BROWSER_API_TOKEN: z.string().optional(),
  FEEDBACK_DISCORD_WEBHOOK_URL: z.url().optional(),
  /**
   * Comma-separated emails allowed to publish curated template assets via
   * POST /api/templates/thumb (dev/staging only). Empty → no one may publish.
   */
  TEMPLATE_MAINTAINER_EMAILS: z.string().optional(),
})

const booleanEnvFlag = z
  .string()
  .optional()
  .transform((value) => value === "true")

/**
 * Schema for client-side environment variables (NEXT_PUBLIC_*).
 */
const clientSchema = z.object({
  NEXT_PUBLIC_ENABLE_DEBUG_PRESETS: booleanEnvFlag,
  NEXT_PUBLIC_ENABLE_TEMPLATE_COPY: booleanEnvFlag,
})

const serverEnv = serverSchema.parse({
  UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_S3_ENDPOINT: process.env.R2_S3_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_API_TOKEN: process.env.R2_API_TOKEN,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_BROWSER_API_TOKEN: process.env.CLOUDFLARE_BROWSER_API_TOKEN,
  FEEDBACK_DISCORD_WEBHOOK_URL: process.env.FEEDBACK_DISCORD_WEBHOOK_URL,
  TEMPLATE_MAINTAINER_EMAILS: process.env.TEMPLATE_MAINTAINER_EMAILS,
})

const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_ENABLE_DEBUG_PRESETS:
    process.env.NEXT_PUBLIC_ENABLE_DEBUG_PRESETS,
  NEXT_PUBLIC_ENABLE_TEMPLATE_COPY:
    process.env.NEXT_PUBLIC_ENABLE_TEMPLATE_COPY,
})

export const env = {
  ...serverEnv,
  ...clientEnv,
} as const

const r2ConfigSchema = z.object({
  bucket: z.string().min(1),
  endpoint: z.url(),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
})

export function requireAuthConfig() {
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env
  if (!BETTER_AUTH_SECRET || !BETTER_AUTH_URL) {
    const missing = [
      !BETTER_AUTH_SECRET && "BETTER_AUTH_SECRET",
      !BETTER_AUTH_URL && "BETTER_AUTH_URL",
    ].filter(Boolean)
    throw new Error(`Missing auth config: ${missing.join(", ")}`)
  }
  return { secret: BETTER_AUTH_SECRET, baseURL: BETTER_AUTH_URL }
}

export function requireR2Config() {
  const parsed = r2ConfigSchema.safeParse({
    bucket: env.R2_BUCKET,
    endpoint: env.R2_S3_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  })
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join("."))
    throw new Error(`Missing R2 config: ${missing.join(", ")}`)
  }
  return parsed.data
}
