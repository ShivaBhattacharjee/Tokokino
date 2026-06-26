import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit"
import {
  unsplashSearchQuerySchema,
  unsplashSearchResponseSchema,
} from "@/lib/schemas/unsplash"

const UNSPLASH_ACCESS_KEY = env.UNSPLASH_ACCESS_KEY

export async function GET(request: Request) {
  if (!UNSPLASH_ACCESS_KEY) {
    return NextResponse.json(
      { error: "Missing UNSPLASH_ACCESS_KEY" },
      { status: 500 }
    )
  }

  const limited = await enforceRateLimit({
    limiter: "HEAVY_RATE_LIMITER",
    scope: "unsplash-search",
    id: getClientIp(request.headers),
  })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const parsedQuery = unsplashSearchQuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    page: searchParams.get("page"),
  })
  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: parsedQuery.error.issues[0]?.message ?? "Missing search query",
      },
      { status: 400 }
    )
  }
  const { q: query, page } = parsedQuery.data

  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: "12",
    orientation: "landscape",
    content_filter: "high",
  })

  const response = await fetch(
    `https://api.unsplash.com/search/photos?${params}`,
    {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
      next: { revalidate: 300 },
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unsplash search failed" },
      { status: response.status }
    )
  }

  const parsedData = unsplashSearchResponseSchema.safeParse(
    await response.json()
  )
  if (!parsedData.success) {
    return NextResponse.json(
      { error: "Unexpected Unsplash response" },
      { status: 502 }
    )
  }
  const data = parsedData.data
  return NextResponse.json({
    page,
    hasMore: page < data.total_pages,
    results: data.results.map((photo) => ({
      id: photo.id,
      alt: photo.alt_description ?? "Unsplash photo",
      thumb: photo.urls.small,
      full: photo.urls.regular,
      downloadLocation: photo.links.download_location,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
    })),
  })
}
