import type { TweetData } from "./state-types"

/**
 * Fetches and normalizes an X or Bluesky post via our `/api/tweet` proxy. Throws an
 * `Error` with a user-facing message on failure so callers can surface it.
 */
export async function fetchTweetData(url: string): Promise<TweetData> {
  const res = await fetch(`/api/tweet?url=${encodeURIComponent(url)}`)
  const data = (await res.json().catch(() => null)) as {
    tweet?: TweetData
    error?: string
  } | null
  if (!res.ok || !data?.tweet) {
    throw new Error(data?.error ?? "Could not load that post")
  }
  return data.tweet
}
