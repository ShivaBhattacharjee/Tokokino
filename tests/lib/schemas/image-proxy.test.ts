import { describe, expect, it } from "vitest"

import { proxyImageUrlSchema } from "@/lib/schemas/image-proxy"

describe("proxyImageUrlSchema", () => {
  it("returns a URL for http and https inputs", () => {
    for (const input of [
      "https://images.unsplash.com/photo-1682687220.jpg",
      "http://images.unsplash.com/photo-1682687220.jpg",
    ]) {
      const result = proxyImageUrlSchema.safeParse(input)
      expect(result.success).toBe(true)
      expect(result.data).toBeInstanceOf(URL)
      expect(result.data?.href).toBe(input)
    }
  })

  it("reports a missing URL", () => {
    const result = proxyImageUrlSchema.safeParse("")
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Missing image URL")
  })

  it("reports an unparseable URL", () => {
    const result = proxyImageUrlSchema.safeParse("not a url")
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Invalid image URL")
  })

  it("rejects non-http(s) protocols", () => {
    for (const input of [
      "ftp://files.unsplash.com/photo.jpg",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
    ]) {
      const result = proxyImageUrlSchema.safeParse(input)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "Unsupported image URL protocol"
      )
    }
  })
})
