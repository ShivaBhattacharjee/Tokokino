import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore
const clipsOf = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!.animation!.clips
}

describe("splitAnimationClip with a multi-screenshot row", () => {
  beforeEach(() => store.getState().reset())

  it("splits a slot-animating clip into two pieces that share the eased motion", () => {
    // A second screenshot in the row (an extra slot).
    const slotId = store.getState().addScreenshotSlot()
    expect(slotId).toBeTruthy()

    // Add a clip, then enter animate mode (which opens it), and scale the slot
    // while it's open so the clip owns the slot's "zoom" keyframe. The live edit
    // lives on the canvas — the clip's stored pose stays stale until a switch.
    const clipId = store.getState().addAnimationClip()
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(clipId)
    store.getState().updateScreenshotSlot(slotId!, { scale: 300 })

    const src = clipsOf()[0]
    expect(src.effects).toContain("zoom")

    // Cut the (currently open) clip at its midpoint.
    const cutMs = src.startMs + src.durationMs / 2
    const newId = store.getState().splitAnimationClip(src.id, cutMs)
    expect(newId).toBeTruthy()

    const after = clipsOf()
    expect(after).toHaveLength(2)
    const [first, second] = [...after].sort((a, b) => a.startMs - b.startMs)

    // First half ends at the cut and holds the eased midpoint slot scale: the
    // slot reveals from rest (100) → the live 300, so at easeOut(0.5)=0.875 → 275.
    expect(first.durationMs).toBe(src.durationMs / 2)
    expect(first.pose?.slots[slotId!].scale).toBeCloseTo(275, 5)
    expect(first.effects).toContain("zoom")

    // Second half continues from the cut to the live target (300) and inherits
    // the open-clip role.
    expect(second.startMs).toBe(cutMs)
    expect(second.pose?.slots[slotId!].scale).toBe(300)
    expect(second.effects).toContain("zoom")
    expect(store.getState().selectedAnimationClipId).toBe(newId)
  })
})
