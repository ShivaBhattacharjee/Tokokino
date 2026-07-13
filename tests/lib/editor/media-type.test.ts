import { describe, expect, it } from "vitest"

import { isVideoSrc } from "@/lib/editor/media-type"

describe("isVideoSrc", () => {
  it("recognizes authenticated private draft media URLs as video", () => {
    expect(
      isVideoSrc("/api/drafts/media/123e4567-e89b-42d3-a456-426614174000")
    ).toBe(true)
  })
})
