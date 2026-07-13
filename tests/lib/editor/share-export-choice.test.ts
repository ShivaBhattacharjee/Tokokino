import { describe, expect, it } from "vitest"

import { shouldUseVideoMediaShareExport } from "@/lib/editor/share-export-choice"

describe("shouldUseVideoMediaShareExport", () => {
  it("uses the video compositor for an Animate-mode video with no keyframes", () => {
    expect(
      shouldUseVideoMediaShareExport({
        isVideoCanvas: true,
        isAnimateMode: true,
        keyframeCount: 0,
      })
    ).toBe(true)
  })

  it("keeps the animation exporter for a video canvas with keyframes", () => {
    expect(
      shouldUseVideoMediaShareExport({
        isVideoCanvas: true,
        isAnimateMode: true,
        keyframeCount: 1,
      })
    ).toBe(false)
  })
})
