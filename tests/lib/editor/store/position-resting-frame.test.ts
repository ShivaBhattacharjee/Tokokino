import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore
const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}
const clipsOf = () => activeCanvas().animation!.clips

describe("position animation resting frame", () => {
  beforeEach(() => store.getState().reset())

  it("rests at the START (center), not the END, after exiting animate mode", () => {
    store.getState().addAnimationClip()
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(clipsOf()[0].id)
    // Move the main screenshot center -> bottom cell (a "move", not an entrance).
    store.getState().setScreenshotPosition("4-2")
    // The open clip now owns the position effect (its pose is captured on exit).
    expect(clipsOf()[0].effects).toContain("position")

    store.getState().setIsAnimateMode(false)

    // Static/committed canvas holds where the move BEGINS, not where it ends.
    expect(activeCanvas().screenshotPosition).toBe("center")
    // The animation itself is preserved: it still travels to the bottom cell.
    expect(clipsOf()[0].pose?.screenshotPosition).toBe("4-2")
  })

  it("keeps the move intact across an animate-mode round trip", () => {
    store.getState().addAnimationClip()
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(clipsOf()[0].id)
    store.getState().setScreenshotPosition("4-2")
    store.getState().setIsAnimateMode(false)

    // Re-entering must not flatten the move by folding the resting (start) pose
    // into the clip's end keyframe.
    store.getState().setIsAnimateMode(true)
    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().screenshotPosition).toBe("center")
    expect(clipsOf()[0].pose?.screenshotPosition).toBe("4-2")
    expect(clipsOf()[0].baseline?.screenshotPosition).toBe("center")
  })
})
