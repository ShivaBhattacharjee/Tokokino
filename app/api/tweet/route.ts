import { NextResponse } from "next/server"

import type { TweetData, TweetMedia } from "@/lib/editor/state-types"
import {
  syndicationToken,
  tweetUrlSchema,
  type SocialPostRef,
} from "@/lib/editor/tweet-url"
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"

const FETCH_TIMEOUT_MS = 10_000
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
}

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
  retweet_count?: number
  quote_count?: number
  view_count?: number | string
  viewCount?: number | string
  impression_count?: number | string
  views?: {
    count?: number | string
  }
  user?: SyndicationUser
  photos?: SyndicationPhoto[]
  mediaDetails?: SyndicationMediaDetail[]
  quoted_tweet?: SyndicationTweet
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
  original_info?: {
    width?: number
    height?: number
  }
  sizes?: Partial<
    Record<
      "large" | "medium" | "small" | "thumb",
      {
        w?: number
        h?: number
      }
    >
  >
  ext_alt_text?: string
  alt_text?: string
}

type BlueskyAuthor = {
  handle?: string
  displayName?: string
  avatar?: string
  verification?: {
    verifiedStatus?: string
  }
}

type BlueskyPostRecord = {
  text?: string
  createdAt?: string
}

type BlueskyImageView = {
  thumb?: string
  fullsize?: string
  alt?: string
  aspectRatio?: {
    width?: number
    height?: number
  }
}

type BlueskyExternalView = {
  thumb?: string
  title?: string
}

type BlueskyEmbedView = {
  $type?: string
  images?: BlueskyImageView[]
  media?: BlueskyEmbedView
  external?: BlueskyExternalView
  record?: BlueskyRecordView | { record?: BlueskyRecordView }
}

type BlueskyPostView = {
  uri?: string
  author?: BlueskyAuthor
  record?: BlueskyPostRecord
  embed?: BlueskyEmbedView
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  indexedAt?: string
}

type BlueskyRecordView = {
  $type?: string
  uri?: string
  author?: BlueskyAuthor
  value?: BlueskyPostRecord
  embeds?: BlueskyEmbedView[]
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  indexedAt?: string
}

type BlueskyThreadResponse = {
  thread?: {
    post?: BlueskyPostView
  }
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
        width:
          media.width ?? media.original_info?.width ?? media.sizes?.large?.w,
        height:
          media.height ?? media.original_info?.height ?? media.sizes?.large?.h,
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

function parseMetric(value: number | string | undefined): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined
  if (typeof value !== "string") return undefined
  const parsed = Number(value.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalize(
  raw: SyndicationTweet,
  fallbackId: string,
  depth = 0
): TweetData | null {
  if (!raw || raw.__typename === "TweetTombstone" || !raw.user) return null
  const user = raw.user
  const handle = user.screen_name ?? ""
  const media = normalizeMedia(raw)
  const id = raw.id_str ?? fallbackId
  const quotedTweet =
    depth === 0 && raw.quoted_tweet
      ? normalize(raw.quoted_tweet, raw.quoted_tweet.id_str ?? "", depth + 1)
      : null

  return {
    source: "x",
    id,
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
    ...(quotedTweet ? { quotedTweet } : {}),
    metrics: {
      likes: raw.favorite_count ?? 0,
      replies: raw.conversation_count ?? raw.reply_count ?? 0,
      reposts: raw.retweet_count ?? raw.quote_count ?? 0,
      ...(() => {
        const views = parseMetric(
          raw.views?.count ??
            raw.view_count ??
            raw.viewCount ??
            raw.impression_count
        )
        return views === undefined ? {} : { views }
      })(),
    },
  }
}

function blueskyPostUrl(author: BlueskyAuthor, uri: string): string {
  const handle = author.handle
  const rkey = uri.split("/").pop() ?? ""
  return handle && rkey
    ? `https://bsky.app/profile/${handle}/post/${rkey}`
    : uri
}

function normalizeBlueskyMedia(
  embed: BlueskyEmbedView | undefined
): TweetMedia[] {
  if (!embed) return []
  const type = embed.$type ?? ""
  if (type.includes("recordWithMedia")) {
    return normalizeBlueskyMedia(embed.media)
  }
  if (type.includes("images")) {
    return (embed.images ?? [])
      .map((image): TweetMedia | null => {
        const url = image.fullsize ?? image.thumb
        if (!url) return null
        return {
          type: "photo",
          url,
          width: image.aspectRatio?.width,
          height: image.aspectRatio?.height,
          alt: image.alt,
        }
      })
      .filter((media): media is TweetMedia => Boolean(media))
  }
  if (type.includes("external") && embed.external?.thumb) {
    return [
      {
        type: "photo",
        url: embed.external.thumb,
        alt: embed.external.title,
      },
    ]
  }
  return []
}

function blueskyQuoteRecord(
  embed: BlueskyEmbedView | undefined
): BlueskyRecordView | null {
  if (!embed) return null
  const type = embed.$type ?? ""
  if (!type.includes("record")) return null
  const record = embed.record
  if (!record) return null
  if ("record" in record && record.record) return record.record
  return record as BlueskyRecordView
}

function normalizeBlueskyRecord(
  record: BlueskyRecordView | null,
  depth: number
): TweetData | null {
  if (!record?.uri || !record.author) return null
  const media = (record.embeds ?? []).flatMap(normalizeBlueskyMedia)
  const quotedRecord =
    depth === 0
      ? (record.embeds?.map(blueskyQuoteRecord).find(Boolean) ?? null)
      : null
  const quotedTweet = quotedRecord
    ? normalizeBlueskyRecord(quotedRecord, depth + 1)
    : null

  return {
    source: "bluesky",
    id: record.uri,
    url: blueskyPostUrl(record.author, record.uri),
    text: record.value?.text ?? "",
    author: {
      name: record.author.displayName ?? record.author.handle ?? "",
      handle: record.author.handle ?? "",
      avatarUrl: record.author.avatar ?? "",
      verified: record.author.verification?.verifiedStatus === "valid",
    },
    createdAt: record.value?.createdAt ?? record.indexedAt ?? "",
    media,
    ...(quotedTweet ? { quotedTweet } : {}),
    metrics: {
      likes: record.likeCount ?? 0,
      replies: record.replyCount ?? 0,
      reposts: record.repostCount ?? 0,
    },
  }
}

function normalizeBlueskyPost(
  post: BlueskyPostView | undefined
): TweetData | null {
  if (!post?.uri || !post.author) return null
  const quotedRecord = blueskyQuoteRecord(post.embed)
  const quotedTweet = quotedRecord
    ? normalizeBlueskyRecord(quotedRecord, 1)
    : null

  return {
    source: "bluesky",
    id: post.uri,
    url: blueskyPostUrl(post.author, post.uri),
    text: post.record?.text ?? "",
    author: {
      name: post.author.displayName ?? post.author.handle ?? "",
      handle: post.author.handle ?? "",
      avatarUrl: post.author.avatar ?? "",
      verified: post.author.verification?.verifiedStatus === "valid",
    },
    createdAt: post.record?.createdAt ?? post.indexedAt ?? "",
    media: normalizeBlueskyMedia(post.embed),
    ...(quotedTweet ? { quotedTweet } : {}),
    metrics: {
      likes: post.likeCount ?? 0,
      replies: post.replyCount ?? 0,
      reposts: post.repostCount ?? 0,
    },
  }
}

async function fetchXPost(id: string): Promise<NextResponse> {
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

  return NextResponse.json({ tweet }, { headers: PUBLIC_CACHE_HEADERS })
}

async function fetchBlueskyPost(
  ref: Extract<SocialPostRef, { platform: "bluesky" }>
) {
  const endpoint = new URL(
    "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread"
  )
  endpoint.searchParams.set(
    "uri",
    `at://${ref.identifier}/app.bsky.feed.post/${ref.rkey}`
  )
  endpoint.searchParams.set("depth", "0")
  endpoint.searchParams.set("parentHeight", "0")

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
        { error: "Bluesky took too long to respond" },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: "Could not load that Bluesky post" },
      { status: 502 }
    )
  }

  if (response.status === 404) {
    return NextResponse.json(
      { error: "Bluesky post not found or unavailable" },
      { status: 404 }
    )
  }
  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not load that Bluesky post" },
      { status: 502 }
    )
  }

  let raw: BlueskyThreadResponse
  try {
    raw = await response.json()
  } catch {
    return NextResponse.json(
      { error: "Could not read that Bluesky post" },
      { status: 502 }
    )
  }

  const tweet = normalizeBlueskyPost(raw.thread?.post)
  if (!tweet) {
    return NextResponse.json(
      { error: "That Bluesky post is deleted, private, or unavailable" },
      { status: 404 }
    )
  }

  return NextResponse.json({ tweet }, { headers: PUBLIC_CACHE_HEADERS })
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
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid X or Bluesky post link",
      },
      { status: 400 }
    )
  }

  return parsed.data.platform === "x"
    ? fetchXPost(parsed.data.id)
    : fetchBlueskyPost(parsed.data)
}
