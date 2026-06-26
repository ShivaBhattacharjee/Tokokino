import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock("@/lib/env", () => ({
  env: { UNSPLASH_ACCESS_KEY: "test-key" },
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: mocks.getClientIp,
}))

async function loadRoute() {
  return import("@/app/api/unsplash/search/route")
}

function request(query: string) {
  return new Request(`http://localhost:3000/api/unsplash/search${query}`, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  })
}

function unsplashPayload(totalPages = 2) {
  return {
    total_pages: totalPages,
    results: [
      {
        id: "Dwu85P9SOlk",
        alt_description: "a cat",
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
  }
}

describe("GET /api/unsplash/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getClientIp.mockReturnValue("203.0.113.10")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rejects a missing query", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(request(""))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Missing search query",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns reshaped results and pagination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(unsplashPayload(2)), {
          headers: { "content-type": "application/json" },
        })
      )
    )
    const { GET } = await loadRoute()

    const response = await GET(request("?q=cats&page=1"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      page: 1,
      hasMore: true,
      results: [
        {
          id: "Dwu85P9SOlk",
          alt: "a cat",
          thumb: "https://images.unsplash.com/photo-1?w=400",
          full: "https://images.unsplash.com/photo-1?w=1080",
          downloadLocation:
            "https://api.unsplash.com/photos/Dwu85P9SOlk/download",
          photographer: "Ada Lovelace",
          photographerUrl: "https://unsplash.com/@ada",
        },
      ],
    })
  })

  it("clamps an invalid page to 1 when calling Unsplash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(unsplashPayload(1)), {
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(request("?q=cats&page=abc"))

    expect(response.status).toBe(200)
    const calledUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(calledUrl).toContain("page=1")
    await expect(response.json()).resolves.toMatchObject({
      page: 1,
      hasMore: false,
    })
  })

  it("returns 502 when Unsplash sends an unexpected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ results: [{ id: "p1" }] }), {
          headers: { "content-type": "application/json" },
        })
      )
    )
    const { GET } = await loadRoute()

    const response = await GET(request("?q=cats"))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: "Unexpected Unsplash response",
    })
  })
})
