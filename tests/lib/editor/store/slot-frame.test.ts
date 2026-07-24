import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import type { DeviceFrame } from "@/lib/editor/state-types"

const store = useEditorStore
const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

const iphone: DeviceFrame = {
  id: "iphone-16-pro",
  color: "black",
  orientation: "vertical",
}
const android: DeviceFrame = {
  id: "pixel-9",
  color: "black",
  orientation: "vertical",
}

describe("per-slot device frame", () => {
  beforeEach(() => store.getState().reset())

  it("sets a frame on a single slot without touching the canvas or siblings", () => {
    const a = store.getState().addScreenshotSlot()!
    const b = store.getState().addScreenshotSlot()!
    const canvasFrameBefore = activeCanvas().frame

    store.getState().updateScreenshotSlot(a, { frame: iphone })

    const canvas = activeCanvas()
    const slotA = canvas.screenshotSlots.find((s) => s.id === a)!
    const slotB = canvas.screenshotSlots.find((s) => s.id === b)!
    expect(slotA.frame).toEqual(iphone)
    // Sibling and canvas are untouched — this is the reported bug's fix.
    expect(slotB.frame).toBeUndefined()
    expect(canvas.frame).toEqual(canvasFrameBefore)
  })

  it("changing the MAIN frame pins inheriting slots to the previous frame", () => {
    const inheriting = store.getState().addScreenshotSlot()!
    const overridden = store.getState().addScreenshotSlot()!
    store.getState().updateScreenshotSlot(overridden, { frame: android })
    const previousCanvasFrame = activeCanvas().frame

    // Main selected → change only the main; the inheriting sibling must not move.
    store.getState().setMainScreenshotFrame(iphone)

    const canvas = activeCanvas()
    expect(canvas.frame).toEqual(iphone)
    const inheritingSlot = canvas.screenshotSlots.find(
      (s) => s.id === inheriting
    )!
    const overriddenSlot = canvas.screenshotSlots.find(
      (s) => s.id === overridden
    )!
    // The previously-inheriting slot is pinned so it keeps its old look.
    expect(inheritingSlot.frame).toEqual(previousCanvasFrame)
    // The already-overridden slot keeps its own frame.
    expect(overriddenSlot.frame).toEqual(android)
  })

  it("clears per-slot frame overrides when applying a frame to all", () => {
    const a = store.getState().addScreenshotSlot()!
    store.getState().updateScreenshotSlot(a, { frame: iphone })
    expect(activeCanvas().screenshotSlots[0]?.frame).toEqual(iphone)

    // No slot selected → "apply to all" resets everyone onto the new frame.
    store.getState().setFrameForMatchingScreenshots(android)

    const canvas = activeCanvas()
    expect(canvas.frame.id).toBe("pixel-9")
    expect(canvas.screenshotSlots[0]?.frame).toBeUndefined()
  })

  it("keeps per-slot frames when arranging the row", () => {
    const a = store.getState().addScreenshotSlot()!
    store.getState().updateScreenshotSlot(a, { frame: iphone })

    store.getState().arrangeScreenshotSlotsInRow()

    expect(activeCanvas().screenshotSlots[0]?.frame).toEqual(iphone)
  })

  it("retains per-slot frames when applying a custom preset snapshot", () => {
    const a = store.getState().addScreenshotSlot()!
    store.getState().updateScreenshotSlot(a, { frame: android, padding: 64 })

    store.getState().applyPresetSnapshot({
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 100,
      slots: [
        {
          xPct: 70,
          yPct: 50,
          rotation: 0,
          tilt: { rx: 0, ry: 0, rz: 0 },
          scale: 100,
        },
      ],
      mainOffset: { xPct: 0, yPct: 0 },
    })

    const slot = activeCanvas().screenshotSlots[0]
    expect(slot?.frame).toEqual(android)
    expect(slot?.padding).toBe(64)
    expect(slot?.xPct).toBe(70)
  })
})
