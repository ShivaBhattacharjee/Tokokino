import { describe, expect, it } from "vitest"

import {
  unsplashDownloadQuerySchema,
  unsplashSearchQuerySchema,
  unsplashSearchResponseSchema,
} from "@/lib/schemas/unsplash"

describe("unsplashSearchQuerySchema", () => {
  it("accepts a query and trims it", () => {
    const result = unsplashSearchQuerySchema.safeParse({
      q: "  mountains  ",
      page: "3",
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ q: "mountains", page: 3 })
  })

  it("rejects an empty query", () => {
    const result = unsplashSearchQuerySchema.safeParse({ q: "", page: "1" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Missing search query")
  })

  it("falls back to page 1 for missing, zero, negative, or junk values", () => {
    for (const page of [null, undefined, "0", "-4", "abc", ""]) {
      const result = unsplashSearchQuerySchema.safeParse({ q: "x", page })
      expect(result.success).toBe(true)
      expect(result.data?.page).toBe(1)
    }
  })

  it("floors fractional page numbers by rejecting them to the fallback", () => {
    const result = unsplashSearchQuerySchema.safeParse({ q: "x", page: "2.5" })
    expect(result.success).toBe(true)
    // 2.5 is not an int, so it falls back to 1 rather than silently truncating.
    expect(result.data?.page).toBe(1)
  })
})

describe("unsplashDownloadQuerySchema", () => {
  it("accepts an Unsplash API download URL", () => {
    const url = "https://api.unsplash.com/photos/Dwu85P9SOlk/download"
    const result = unsplashDownloadQuerySchema.safeParse({ url })
    expect(result.success).toBe(true)
    expect(result.data?.url).toBe(url)
  })

  it("rejects non-Unsplash URLs", () => {
    const result = unsplashDownloadQuerySchema.safeParse({
      url: "https://track.malicious-host.test/pixel",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "Missing Unsplash download location"
    )
  })

  it("rejects empty / malformed URLs", () => {
    for (const url of ["", "not-a-url", "api.unsplash.com/photos"]) {
      const result = unsplashDownloadQuerySchema.safeParse({ url })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "Missing Unsplash download location"
      )
    }
  })
})

describe("unsplashSearchResponseSchema", () => {
  it("parses a well-formed Unsplash response", () => {
    const result = unsplashSearchResponseSchema.safeParse({
      total_pages: 5,
      results: [
        {
          id: "Dwu85P9SOlk",
          alt_description: null,
          urls: {
            small: "https://images.unsplash.com/photo-1?w=400",
            regular: "https://images.unsplash.com/photo-1?w=1080",
            full: "https://images.unsplash.com/photo-1",
          },
          user: {
            name: "Ada Lovelace",
            links: { html: "https://unsplash.com/@ada" },
          },
          links: {
            download_location:
              "https://api.unsplash.com/photos/Dwu85P9SOlk/download",
          },
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.results).toHaveLength(1)
  })

  it("rejects a response missing required fields", () => {
    const result = unsplashSearchResponseSchema.safeParse({
      total_pages: 5,
      results: [{ id: "p1" }],
    })
    expect(result.success).toBe(false)
  })
})
