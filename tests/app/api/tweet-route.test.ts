import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: mocks.getClientIp,
}))

const MALFORMED_BSKY_URLS = ["%", "%2", "%GG", "%E0%A4"].flatMap((value) => [
  `https://bsky.app/profile/${value}/post/abc123`,
  `https://bsky.app/profile/bsky.app/post/${value}`,
])

function request(url: string) {
  const endpoint = new URL("http://localhost:3000/api/tweet")
  endpoint.searchParams.set("url", url)
  return new Request(endpoint, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  })
}

describe("GET /api/tweet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getClientIp.mockReturnValue("203.0.113.10")
  })

  afterEach(() => vi.unstubAllGlobals())

  it.each(MALFORMED_BSKY_URLS)(
    "returns a validation response for malformed Bluesky input %s",
    async (url) => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const { GET } = await import("@/app/api/tweet/route")

      const response = await GET(request(url))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: "Enter a valid X or Bluesky post link",
      })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["https://bsky.app/profile/bsky.app/post/abc123", "bsky.app"],
    [
      "https://bsky.app/profile/did%3Aplc%3Aexample/post/abc%31%32%33",
      "did:plc:example",
    ],
  ])("fetches a valid Bluesky post %s", async (url, identifier) => {
    const uri = `at://${identifier}/app.bsky.feed.post/abc123`
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          thread: {
            post: {
              uri,
              author: { handle: "bsky.app", displayName: "Bluesky" },
              record: {
                text: "A test post",
                createdAt: "2026-10-02T00:00:00Z",
              },
            },
          },
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await import("@/app/api/tweet/route")

    const response = await GET(request(url))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      tweet: { source: "bluesky", id: uri, text: "A test post" },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const endpoint = fetchMock.mock.calls[0]?.[0]
    if (!(endpoint instanceof URL)) {
      throw new Error("Expected the Bluesky fetch to receive a URL")
    }
    expect(endpoint.origin + endpoint.pathname).toBe(
      "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread"
    )
    expect(endpoint.searchParams.get("uri")).toBe(uri)
  })
})
