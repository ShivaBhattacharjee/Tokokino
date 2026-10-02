import { z } from "zod/v4"

/** An x.com / twitter.com status link, e.g. https://x.com/jack/status/20. */
const STATUS_RE = /(?:twitter\.com|x\.com)\/[^/?#]+\/status(?:es)?\/(\d+)/i
/** The post path on bsky.app; percent-encoded segments are decoded separately. */
const BSKY_POST_PATH_RE = /^\/profile\/([^/?#]+)\/post\/([^/?#]+)\/?$/i
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

/** Recognizes a Bluesky post link even when its encoded segments are invalid. */
export function isBlueskyPostUrl(input: string): boolean {
  return matchBlueskyPost(input) !== null
}

function matchBlueskyPost(input: string): RegExpMatchArray | null {
  const trimmed = input.trim()
  const normalized = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : trimmed.startsWith("//")
      ? `https:${trimmed}`
      : `https://${trimmed}`
  try {
    const url = new URL(normalized)
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.hostname !== "bsky.app"
    ) {
      return null
    }
    return url.pathname.match(BSKY_POST_PATH_RE)
  } catch {
    return null
  }
}

function parseBlueskyPost(input: string): SocialPostRef | null {
  const match = matchBlueskyPost(input)
  if (!match) return null
  try {
    return {
      platform: "bluesky",
      identifier: decodeURIComponent(match[1] ?? ""),
      rkey: decodeURIComponent(match[2] ?? ""),
    }
  } catch {
    return null
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
