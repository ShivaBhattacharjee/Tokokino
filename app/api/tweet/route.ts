import { NextResponse } from "next/server"

import type { TweetData, TweetMedia } from "@/lib/editor/state-types"
import { syndicationToken, tweetUrlSchema } from "@/lib/editor/tweet-url"
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"

const FETCH_TIMEOUT_MS = 10_000

type SyndicationUser = {
  name?: string
  screen_name?: string
  profile_image_url_https?: string
  verified?: boolean
  is_blue_verified?: boolean
}

type SyndicationTweet = {
  __typename?: string
  id_str?: string
  text?: string
  full_text?: string
  created_at?: string
  favorite_count?: number
  conversation_count?: number
  reply_count?: number
  user?: SyndicationUser
  photos?: SyndicationPhoto[]
  mediaDetails?: SyndicationMediaDetail[]
}

type SyndicationPhoto = {
  url?: string
  width?: number
  height?: number
  alt_text?: string
}

type SyndicationMediaDetail = {
  type?: string
  media_url_https?: string
  media_url?: string
  url?: string
  width?: number
  height?: number
  ext_alt_text?: string
  alt_text?: string
}

/** Twitter avatars come back at `_normal` (48px); request the larger crop. */
function upgradeAvatar(url: string | undefined): string {
  if (!url) return ""
  return url.replace(/_normal(\.\w+)$/, "_400x400$1")
}

function normalizeMedia(raw: SyndicationTweet): TweetMedia[] {
  const photosFromField = (raw.photos ?? [])
    .map((photo): TweetMedia | null =>
      photo.url
        ? {
            type: "photo",
            url: photo.url,
            width: photo.width,
            height: photo.height,
            alt: photo.alt_text,
          }
        : null
    )
    .filter((media): media is TweetMedia => Boolean(media))

  const photosFromDetails = (raw.mediaDetails ?? [])
    .filter((media) => media.type === "photo" || media.media_url_https)
    .map((media): TweetMedia | null => {
      const url = media.media_url_https ?? media.media_url ?? media.url
      if (!url) return null
      return {
        type: "photo",
        url,
        width: media.width,
        height: media.height,
        alt: media.ext_alt_text ?? media.alt_text,
      }
    })
    .filter((media): media is TweetMedia => Boolean(media))

  const seen = new Set<string>()
  return [...photosFromField, ...photosFromDetails].filter((media) => {
    if (seen.has(media.url)) return false
    seen.add(media.url)
    return true
  })
}

function normalizeTweetText(text: string, hasMedia: boolean): string {
  if (!hasMedia) return text
  return text.replace(/\s*https:\/\/t\.co\/\S+\s*$/i, "").trimEnd()
}

function normalize(raw: SyndicationTweet, id: string): TweetData | null {
  if (!raw || raw.__typename === "TweetTombstone" || !raw.user) return null
  const user = raw.user
  const handle = user.screen_name ?? ""
  const media = normalizeMedia(raw)
  return {
    id: raw.id_str ?? id,
    url: handle
      ? `https://x.com/${handle}/status/${id}`
      : `https://x.com/i/status/${id}`,
    text: normalizeTweetText(raw.text ?? raw.full_text ?? "", media.length > 0),
    author: {
      name: user.name ?? handle,
      handle,
      avatarUrl: upgradeAvatar(user.profile_image_url_https),
      verified: Boolean(user.verified || user.is_blue_verified),
    },
    createdAt: raw.created_at ?? "",
    media,
    metrics: {
      likes: raw.favorite_count ?? 0,
      replies: raw.conversation_count ?? raw.reply_count ?? 0,
    },
  }
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit({
    limiter: "HEAVY_RATE_LIMITER",
    scope: "tweet-fetch",
    id: getClientIp(request.headers),
  })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const parsed = tweetUrlSchema.safeParse(searchParams.get("url") ?? "")
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid X post link" },
      { status: 400 }
    )
  }

  const id = parsed.data
  const endpoint = new URL("https://cdn.syndication.twimg.com/tweet-result")
  endpoint.searchParams.set("id", id)
  endpoint.searchParams.set("token", syndicationToken(id))
  endpoint.searchParams.set("lang", "en")

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Tokokino/1.0; +https://tokokino.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "X took too long to respond" },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: "Could not load that post" },
      { status: 502 }
    )
  }

  if (response.status === 404) {
    return NextResponse.json(
      { error: "Post not found or unavailable" },
      { status: 404 }
    )
  }
  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not load that post" },
      { status: 502 }
    )
  }

  let raw: SyndicationTweet
  try {
    raw = await response.json()
  } catch {
    return NextResponse.json(
      { error: "Could not read that post" },
      { status: 502 }
    )
  }

  const tweet = normalize(raw, id)
  if (!tweet) {
    return NextResponse.json(
      { error: "That post is deleted, private, or unavailable" },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { tweet },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  )
}
