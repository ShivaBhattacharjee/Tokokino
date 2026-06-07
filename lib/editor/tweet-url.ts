import { z } from "zod/v4"

/** An x.com / twitter.com status link, e.g. https://x.com/jack/status/20. */
const STATUS_RE = /(?:twitter\.com|x\.com)\/[^/?#]+\/status(?:es)?\/(\d+)/i
/** A bare numeric tweet id pasted on its own. */
const BARE_ID_RE = /^\d{1,20}$/

/** Extracts the numeric tweet id from a full URL or a bare id, else null. */
export function parseTweetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (BARE_ID_RE.test(trimmed)) return trimmed
  return trimmed.match(STATUS_RE)?.[1] ?? null
}

/** Validates user input and resolves it to a tweet id. */
export const tweetUrlSchema = z
  .string()
  .trim()
  .min(1, "Paste an X post link")
  .transform((value, ctx) => {
    const id = parseTweetId(value)
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Enter a valid X post link" })
      return z.NEVER
    }
    return id
  })

/**
 * Token expected by the public X syndication endpoint. Deterministically
 * derived from the tweet id (mirrors react-tweet) — no auth/secret required.
 */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")
}
