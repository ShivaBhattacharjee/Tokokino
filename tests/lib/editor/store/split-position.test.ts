import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore
const clipsOf = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!.animation!.clips
}

describe("splitAnimationClip with a position animation", () => {
  beforeEach(() => store.getState().reset())

  it("lands the first half at the midpoint cell, not the full target", () => {
    const clipId = store.getState().addAnimationClip()
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(clipId)
    // Animate the main screenshot from its rest (center) to the top-left cell.
    store.getState().setScreenshotPosition("0-0")

    const src = clipsOf()[0]
    expect(src.effects).toContain("position")

    const cutMs = src.startMs + src.durationMs / 2
    store.getState().splitAnimationClip(src.id, cutMs)

    const [first, second] = [...clipsOf()].sort((a, b) => a.startMs - b.startMs)

    // Point-space midpoint: center (50,50) → top-left (0,0) at easeOut(0.5)=0.875
    // gives (6.25, 6.25). Pinned to the target cell "0-0" (anchor 0,0), that's a
    // pixel offset of 6.25% * 1100 = 68.75 on x — NOT 0 (the full target), which
    // is what the old "keep target cell, lerp offset only" code produced.
    expect(first.pose?.screenshotPosition).toBe("0-0")
    expect(first.pose?.screenshotOffset.x).toBeCloseTo(68.75, 3)
    expect(first.effects).toContain("position")

    // Second half completes the move: sits exactly at the target cell, no offset.
    expect(second.pose?.screenshotPosition).toBe("0-0")
    expect(second.pose?.screenshotOffset.x).toBeCloseTo(0, 6)
  })
})
