import { describe, expect, it } from "vitest"

import { extractDraftMediaIds } from "@/lib/schemas/draft"

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
