import { describe, expect, it } from "vitest"

import {
  cropAspectForFrameScreen,
  resolveSlotCropFrame,
} from "@/lib/editor/crop-utils"
import { glassFrameScreenAspect } from "@/lib/glass-frame"
import type { DeviceFrame } from "@/lib/editor/state-types"

const canvasFrame: DeviceFrame = {
  id: "none",
  color: "black",
  orientation: "horizontal",
}

const glassFrame: DeviceFrame = {
  id: "glass-card",
  color: "dark",
  orientation: "horizontal",
}

describe("resolveSlotCropFrame", () => {
  it("uses a slot frame override for crop geometry", () => {
    const frame = resolveSlotCropFrame(glassFrame, canvasFrame)

    expect(frame).toBe(glassFrame)
    expect(cropAspectForFrameScreen(frame)).toBeCloseTo(
      glassFrameScreenAspect(glassFrame.id)!,
      6
    )
  })

  it("falls back to the canvas frame when the slot inherits it", () => {
    expect(resolveSlotCropFrame(undefined, canvasFrame)).toBe(canvasFrame)
  })
})
