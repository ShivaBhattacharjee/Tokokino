import { describe, expect, it } from "vitest"

import { isBlueskyPostUrl, tweetUrlSchema } from "@/lib/editor/tweet-url"

const MALFORMED_PERCENT_ENCODINGS = ["%", "%2", "%GG", "%E0%A4"]
const OTHER_WEBSITE_URLS = [
  "https://example.com/bsky.app/profile/%/post/abc123",
  "https://example.com/?next=https://bsky.app/profile/bsky.app/post/%",
  "https://notbsky.app/profile/%/post/abc123",
  "https://example.com/bsky.app/profile/bsky.app/post/abc123",
  "https://example.com/?next=https://bsky.app/profile/bsky.app/post/abc123",
  "https://notbsky.app/profile/bsky.app/post/abc123",
]

describe("isBlueskyPostUrl", () => {
  it.each([
    "https://bsky.app/profile/bsky.app/post/abc123",
    "http://bsky.app/profile/bsky.app/post/abc123",
    "bsky.app/profile/bsky.app/post/abc123",
    "//bsky.app/profile/bsky.app/post/abc123",
    "https://BSKY.APP/profile/bsky.app/post/abc123",
    "https://bsky.app/PROFILE/bsky.app/POST/abc123/",
    "  https://bsky.app/profile/bsky.app/post/abc123  ",
    "https://bsky.app/profile/did%3Aplc%3Aexample/post/abc%31%32%33?ref=share#post",
  ])("recognizes a supported Bluesky post link %s", (input) => {
    expect(isBlueskyPostUrl(input)).toBe(true)
    expect(tweetUrlSchema.safeParse(input).success).toBe(true)
  })

  it.each(MALFORMED_PERCENT_ENCODINGS)(
    "recognizes malformed Bluesky segments %s",
    (value) => {
      expect(
        isBlueskyPostUrl(`https://bsky.app/profile/${value}/post/abc123`)
      ).toBe(true)
      expect(
        isBlueskyPostUrl(`https://bsky.app/profile/bsky.app/post/${value}`)
      ).toBe(true)
    }
  )

  it.each([
    ...OTHER_WEBSITE_URLS,
    "https://bsky.app/?next=/profile/bsky.app/post/abc123",
    "https://bsky.app/other/profile/bsky.app/post/abc123",
    "https://bsky.app/profile/bsky.app",
    "https://bsky.app.example.com/profile/%/post/abc123",
    "https://bsky.app/profile/bsky.app/post/abc123/other",
    "ftp://bsky.app/profile/bsky.app/post/abc123",
    "not a url",
  ])("does not recognize another hostname or path %s", (input) => {
    expect(isBlueskyPostUrl(input)).toBe(false)
    expect(tweetUrlSchema.safeParse(input).success).toBe(false)
  })
})

describe("tweetUrlSchema", () => {
  it("accepts a Bluesky post link", () => {
    const result = tweetUrlSchema.safeParse(
      "https://bsky.app/profile/bsky.app/post/abc123"
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      platform: "bluesky",
      identifier: "bsky.app",
      rkey: "abc123",
    })
  })

  it("decodes valid percent-encoding in both Bluesky URL segments", () => {
    const result = tweetUrlSchema.safeParse(
      "https://bsky.app/profile/did%3Aplc%3Aexample/post/abc%31%32%33"
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      platform: "bluesky",
      identifier: "did:plc:example",
      rkey: "abc123",
    })
  })

  it.each([
    "https://x.com/jack/status/20",
    "https://twitter.com/jack/status/20",
    "20",
  ])("accepts an X post reference %s", (input) => {
    const result = tweetUrlSchema.safeParse(input)

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ platform: "x", id: "20" })
  })

  it.each(MALFORMED_PERCENT_ENCODINGS)(
    "rejects malformed percent-encoding %s in a Bluesky profile identifier without throwing",
    (identifier) => {
      const result = tweetUrlSchema.safeParse(
        `https://bsky.app/profile/${identifier}/post/abc123`
      )

      expect(result.success).toBe(false)
    }
  )

  it.each(MALFORMED_PERCENT_ENCODINGS)(
    "rejects malformed percent-encoding %s in a Bluesky post ID without throwing",
    (postId) => {
      const result = tweetUrlSchema.safeParse(
        `https://bsky.app/profile/bsky.app/post/${postId}`
      )

      expect(result.success).toBe(false)
    }
  )
})
