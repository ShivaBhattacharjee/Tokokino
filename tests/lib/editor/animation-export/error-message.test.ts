import { describe, expect, it } from "vitest"

import { animationExportErrorMessage } from "@/lib/editor/animation-export/error-message"

describe("animationExportErrorMessage", () => {
  it("explains that an animation needs a keyframe", () => {
    expect(
      animationExportErrorMessage(
        new Error("Add at least one keyframe before sharing")
      )
    ).toBe("Add a keyframe before exporting this animation.")
  })

  it("preserves useful encoder failures", () => {
    expect(
      animationExportErrorMessage(new Error("WebM is not supported."))
    ).toBe("WebM is not supported.")
  })
})
