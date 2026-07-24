import { describe, expect, it } from "vitest"

import { mainScreenshotPositionPct } from "@/components/editor/floating-toolbar-parts/geometry"
import { createScreenshotSlot } from "@/lib/editor/store/canvas-helpers"
import type { AspectState, DeviceFrame } from "@/lib/editor/state-types"

const aspect: AspectState = { id: "16-10", w: 16, h: 10 }
const browser: DeviceFrame = {
  id: "browser",
  color: "dark",
  orientation: "vertical",
}
const galaxy: DeviceFrame = {
  id: "galaxy_s24_ultra",
  color: "black",
  orientation: "vertical",
}

describe("mainScreenshotPositionPct with per-slot frames", () => {
  // Regression: the on-canvas main drag reads its row base position from here,
  // while the render reads it from computeRowLayout with each slot's own frame.
  // If this ignored slot.frame, the two disagreed and the main jumped on drop
  // whenever the sibling had a different frame.
  it("shifts the main's row position when a sibling slot overrides its frame", () => {
    const slots = [createScreenshotSlot({ id: "s" }, 1)]

    const inheriting = mainScreenshotPositionPct({
      aspect,
      frame: browser,
      position: "center",
      offset: { x: 0, y: 0 },
      slots,
    })

    const overridden = mainScreenshotPositionPct({
      aspect,
      frame: browser,
      position: "center",
      offset: { x: 0, y: 0 },
      slots: [{ ...slots[0], frame: galaxy }],
    })

    // A wide browser sibling vs a tall phone sibling redistributes the row, so
    // the main's centre lands at a different xPct.
    expect(inheriting.xPct).not.toBeCloseTo(overridden.xPct, 1)
  })
})
