import { describe, expect, it } from "vitest"

import {
  getPublicShareImageUrl,
  getShareImageUrl,
  getShareObjectKey,
  isValidShareId,
} from "@/lib/share"

const VALID_SHARE_ID = "123e4567-e89b-42d3-a456-426614174000"

describe("share helpers", () => {
  it("validates v1-v5 UUID share ids", () => {
    expect(isValidShareId(VALID_SHARE_ID)).toBe(true)
    expect(isValidShareId("123e4567-e89b-72d3-a456-426614174000")).toBe(false)
    expect(isValidShareId("../not-a-share")).toBe(false)
  })

  it("builds storage keys and image urls from share ids", () => {
    expect(getShareObjectKey(VALID_SHARE_ID)).toBe(
      `shares/${VALID_SHARE_ID}.png`
    )
    expect(getShareImageUrl(VALID_SHARE_ID)).toBe(
      `/api/share/${VALID_SHARE_ID}/image`
    )
    expect(
      getShareImageUrl(VALID_SHARE_ID, "http://localhost:3000/editor")
    ).toBe(`http://localhost:3000/api/share/${VALID_SHARE_ID}/image`)
    expect(getPublicShareImageUrl(VALID_SHARE_ID)).toBe(
      `https://assets.tokokino.com/shares/${VALID_SHARE_ID}.png`
    )
  })
})
