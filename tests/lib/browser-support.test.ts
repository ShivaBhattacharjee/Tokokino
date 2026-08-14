import { describe, expect, it } from "vitest"

import { isSafariUserAgent } from "@/lib/browser-support"

describe("isSafariUserAgent", () => {
  it("blocks Safari on macOS and iOS", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15"
      )
    ).toBe(true)
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 " +
          "Mobile/15E148 Safari/604.1"
      )
    ).toBe(true)
  })

  it("allows Chromium browsers whose user agent also contains Safari", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 " +
          "Safari/537.36"
      )
    ).toBe(false)
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 " +
          "Safari/537.36 Edg/140.0.0.0"
      )
    ).toBe(false)
  })

  it("allows Chrome and Firefox on iOS", () => {
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 " +
          "Mobile/15E148 Safari/604.1"
      )
    ).toBe(false)
    expect(
      isSafariUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 " +
          "Mobile/15E148 Safari/605.1.15"
      )
    ).toBe(false)
  })
})
