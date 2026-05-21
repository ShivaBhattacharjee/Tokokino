import { NextResponse } from "next/server"

import { env } from "@/lib/env"

const UNSPLASH_ACCESS_KEY = env.UNSPLASH_ACCESS_KEY

type UnsplashSearchPhoto = {
  id: string
  alt_description: string | null
  urls: {
    small: string
    regular: string
    full: string
  }
  user: {
    name: string
    links: {
      html: string
    }
  }
  links: {
    download_location: string
  }
}

type UnsplashSearchResponse = {
  results: UnsplashSearchPhoto[]
  total_pages: number
}

export async function GET(request: Request) {
  if (!UNSPLASH_ACCESS_KEY) {
    return NextResponse.json(
      { error: "Missing UNSPLASH_ACCESS_KEY" },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()
  const pageParam = searchParams.get("page")
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  if (!query) {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 })
  }

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

  const data: UnsplashSearchResponse = await response.json()
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
