import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: mocks.getClientIp,
}))

async function loadRoute() {
  return import("@/app/api/export/image/route")
}

function request(url: string) {
  return new Request(url, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  })
}

describe("GET /api/export/image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getClientIp.mockReturnValue("203.0.113.10")
  })

  it("requires a url query parameter", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      request("http://localhost:3000/api/export/image")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Missing image URL",
    })
  })

  it("blocks local and private hosts before fetching", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { GET } = await loadRoute()

    const response = await GET(
      request(
        "http://localhost:3000/api/export/image?url=http://127.0.0.1/a.png"
      )
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Blocked image host",
    })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("returns proxied image bytes with export-friendly headers", async () => {
    const image = new Uint8Array([1, 2, 3, 4])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(image, {
          headers: {
            "content-type": "image/png",
            "content-length": String(image.byteLength),
          },
        })
      )
    )
    const { GET } = await loadRoute()

    const response = await GET(
      request(
        "http://localhost:3000/api/export/image?url=https://cdn.example.com/a.png"
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("access-control-allow-origin")).toBe("*")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(image)
    vi.unstubAllGlobals()
  })

  it("rejects successful responses that are not images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("hello", {
          headers: { "content-type": "text/plain" },
        })
      )
    )
    const { GET } = await loadRoute()

    const response = await GET(
      request(
        "http://localhost:3000/api/export/image?url=https://cdn.example.com/readme.txt"
      )
    )

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({
      error: "URL did not return an image",
    })
    vi.unstubAllGlobals()
  })

  it("blocks redirects to private hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "http://192.168.0.2/image.png" },
        })
      )
    )
    const { GET } = await loadRoute()

    const response = await GET(
      request(
        "http://localhost:3000/api/export/image?url=https://cdn.example.com/a.png"
      )
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Image fetch failed",
    })
    vi.unstubAllGlobals()
  })
})
