import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isUnsplashImageUrl,
  trackUnsplashDownload,
} from "@/lib/editor/unsplash"

describe("isUnsplashImageUrl", () => {
  it("accepts images.unsplash.com http(s) URLs", () => {
    expect(
      isUnsplashImageUrl("https://images.unsplash.com/photo-1?w=1080&fit=max")
    ).toBe(true)
    expect(isUnsplashImageUrl("http://images.unsplash.com/photo-1")).toBe(true)
  })

  it("accepts plus.unsplash.com URLs", () => {
    expect(
      isUnsplashImageUrl("https://plus.unsplash.com/premium_photo-1")
    ).toBe(true)
  })

  it("rejects non-Unsplash hosts and non-URLs", () => {
    expect(isUnsplashImageUrl("https://assets.tokokino.com/bg.jpg")).toBe(false)
    expect(isUnsplashImageUrl("https://evil.unsplash.com.example/x")).toBe(
      false
    )
    expect(isUnsplashImageUrl("data:image/png;base64,abc")).toBe(false)
    expect(isUnsplashImageUrl("")).toBe(false)
    expect(isUnsplashImageUrl(null)).toBe(false)
  })
})

describe("trackUnsplashDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("pings the download proxy with keepalive", () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const location =
      "https://api.unsplash.com/photos/abc/download?ixid=MnwxMTc4"
    trackUnsplashDownload(location)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/unsplash/download?url=${encodeURIComponent(location)}`,
      expect.objectContaining({
        method: "GET",
        keepalive: true,
        credentials: "omit",
        cache: "no-store",
      })
    )
  })

  it("no-ops on empty download locations", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    trackUnsplashDownload("   ")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
