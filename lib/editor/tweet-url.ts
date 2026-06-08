import { z } from "zod/v4"

/** An x.com / twitter.com status link, e.g. https://x.com/jack/status/20. */
const STATUS_RE = /(?:twitter\.com|x\.com)\/[^/?#]+\/status(?:es)?\/(\d+)/i
/** A bsky.app post link, e.g. https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l. */
const BSKY_POST_RE = /bsky\.app\/profile\/([^/?#]+)\/post\/([^/?#]+)/i
/** A bare numeric tweet id pasted on its own. */
const BARE_ID_RE = /^\d{1,20}$/

export type SocialPostRef =
  | { platform: "x"; id: string }
  | { platform: "bluesky"; identifier: string; rkey: string }

/** Extracts the numeric tweet id from a full URL or a bare id, else null. */
export function parseTweetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (BARE_ID_RE.test(trimmed)) return trimmed
  return trimmed.match(STATUS_RE)?.[1] ?? null
}

function parseBlueskyPost(input: string): SocialPostRef | null {
  const match = input.trim().match(BSKY_POST_RE)
  if (!match) return null
  return {
    platform: "bluesky",
    identifier: decodeURIComponent(match[1] ?? ""),
    rkey: decodeURIComponent(match[2] ?? ""),
  }
}

/** Validates user input and resolves it to a supported social post. */
export const tweetUrlSchema = z
  .string()
  .trim()
  .min(1, "Paste an X or Bluesky post link")
  .transform((value, ctx) => {
    const id = parseTweetId(value)
    if (id) return { platform: "x", id } satisfies SocialPostRef

    const blueskyPost = parseBlueskyPost(value)
    if (blueskyPost) return blueskyPost

    ctx.addIssue({
      code: "custom",
      message: "Enter a valid X or Bluesky post link",
    })
    return z.NEVER
  })

/**
 * Token expected by the public X syndication endpoint. Deterministically
 * derived from the tweet id (mirrors react-tweet) — no auth/secret required.
 */
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")
}
