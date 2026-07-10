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
  return import("@/app/api/unsplash/download/route")
}

function request(query: string) {
  return new Request(`http://localhost:3000/api/unsplash/download${query}`, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  })
}

describe("GET /api/unsplash/download", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getClientIp.mockReturnValue("203.0.113.10")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("rejects a non-Unsplash URL without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(request("?url=https://evil.example.com/track"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Missing Unsplash download location",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a missing URL without fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(request(""))

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("tracks a valid Unsplash download location", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(
      request("?url=https://api.unsplash.com/photos/abc/download")
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.unsplash.com/photos/abc/download",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Client-ID test-key",
          "Accept-Version": "v1",
        }),
      })
    )
  })
})
