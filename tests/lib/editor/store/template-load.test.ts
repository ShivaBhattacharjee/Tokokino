import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore

describe("loadTemplateState", () => {
  beforeEach(() => store.getState().reset())

  it("removes every media and crop field from template screenshot slots", () => {
    const slotId = store.getState().addScreenshotSlot()!
    const incoming = structuredClone(store.getState().present)
    const canvas = incoming.canvases.find(
      (item) => item.id === incoming.activeCanvasId
    )!
    const slot = canvas.screenshotSlots.find((item) => item.id === slotId)!
    slot.src = "template-crop.png"
    slot.originalSrc = "template-original.png"
    slot.lastCropRegion = { x: 1, y: 2, width: 300, height: 200 }
    slot.fullPageCapture = { scrollPosition: 480 }

    store.getState().loadTemplateState(incoming)

    const loaded = store
      .getState()
      .present.canvases.find((item) => item.id === incoming.activeCanvasId)!
      .screenshotSlots.find((item) => item.id === slotId)!
    expect(loaded.src).toBeNull()
    expect(loaded.originalSrc).toBeNull()
    expect(loaded.lastCropRegion).toBeNull()
    expect(loaded.fullPageCapture).toBeNull()
  })
})
