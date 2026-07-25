import { describe, expect, it } from "vitest"

import {
  draftMediaExtension,
  extractDraftMediaIds,
  normalizeDraftMediaContentType,
} from "@/lib/schemas/draft"

const FIRST_MEDIA_ID = "123e4567-e89b-42d3-a456-426614174000"
const SECOND_MEDIA_ID = "123e4567-e89b-42d3-a456-426614174001"

describe("extractDraftMediaIds", () => {
  it("collects each private video source once across main, original, and slots", () => {
    const state = {
      schemaVersion: 1,
      present: {
        canvases: [
          {
            screenshot: `/api/drafts/media/${FIRST_MEDIA_ID}`,
            originalScreenshot: `http://localhost:3000/api/drafts/media/${FIRST_MEDIA_ID}`,
            screenshotSlots: [
              { src: `/api/drafts/media/${SECOND_MEDIA_ID}` },
              { src: "https://images.example.com/photo.jpg" },
              { src: `/api/drafts/media/${FIRST_MEDIA_ID}?ignored=true` },
            ],
          },
        ],
      },
      ui: {},
    }

    expect(extractDraftMediaIds(state)).toEqual([
      FIRST_MEDIA_ID,
      SECOND_MEDIA_ID,
    ])
  })
})

describe("normalizeDraftMediaContentType", () => {
  it("accepts every video type the editor's picker allows", () => {
    expect(normalizeDraftMediaContentType("video/quicktime")).toBe(
      "video/quicktime"
    )
    expect(normalizeDraftMediaContentType("Video/MP4; codecs=avc1")).toBe(
      "video/mp4"
    )
    expect(normalizeDraftMediaContentType("video/x-matroska")).toBe(
      "video/x-matroska"
    )
  })

  it("rejects non-video and malformed types", () => {
    expect(normalizeDraftMediaContentType("image/png")).toBeNull()
    expect(normalizeDraftMediaContentType("video/")).toBeNull()
    expect(normalizeDraftMediaContentType("")).toBeNull()
    expect(normalizeDraftMediaContentType(null)).toBeNull()
  })
})

describe("draftMediaExtension", () => {
  it("keeps the existing keys for the formats drafts already stored", () => {
    expect(draftMediaExtension("video/mp4")).toBe("mp4")
    expect(draftMediaExtension("video/webm")).toBe("webm")
  })

  it("maps and sanitizes the rest", () => {
    expect(draftMediaExtension("video/quicktime")).toBe("mov")
    expect(draftMediaExtension("video/ogg")).toBe("ogv")
    expect(draftMediaExtension("video/x-flv")).toBe("flv")
    expect(draftMediaExtension("video/...")).toBe("video")
  })
})
