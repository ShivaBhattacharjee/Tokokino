import { z } from "zod/v4"

/**
 * Validates the `url` query param for `GET /api/export/image`.
 *
 * This only covers the *shape* of the URL (present, parseable, http/https).
 * SSRF protection — blocking loopback/private hosts and validating redirect
 * targets — stays in the route as runtime checks, since it depends on DNS
 * shape and the redirect chain rather than the static string.
 */
export const proxyImageUrlSchema = z
  .string()
  .min(1, "Missing image URL")
  .transform((value, ctx) => {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid image URL" })
      return z.NEVER
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: "Unsupported image URL protocol",
      })
      return z.NEVER
    }

    return parsed
  })
