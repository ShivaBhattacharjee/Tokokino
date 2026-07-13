import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import type { Background } from "@/lib/editor/state-types"

const store = useEditorStore

const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}
const clips = () => activeCanvas().animation!.clips

// Enter Animate mode with a single clip open for editing — the state a restored
// draft lands in, and where a stray setBackground would be recorded as a keyframe.
const enterAnimateWithOpenClip = () => {
  const id = store.getState().addAnimationClip()
  store.getState().setIsAnimateMode(true)
  store.getState().selectAnimationClip(id)
  return id
}

describe("setBackground silent option", () => {
  beforeEach(() => store.getState().reset())

  it("does not record a 'background' keyframe effect when silent", () => {
    const id = enterAnimateWithOpenClip()
    const next: Background = {
      type: "image",
      value: "data:image/png;base64,optimized",
      sourceUrl: activeCanvas().background.sourceUrl,
    }

    store.getState().setBackground(next, undefined, { silent: true })

    // The hydration/downscale swap must not mark the open clip as animating the
    // background — that's what spuriously showed the palette icon on reload.
    expect(clips().find((c) => c.id === id)?.effects ?? []).not.toContain(
      "background"
    )
    expect(activeCanvas().background.value).toBe(next.value)
  })

  it("still records the effect for a real user edit (non-silent)", () => {
    const id = enterAnimateWithOpenClip()

    store.getState().setBackground({ type: "solid", value: "#ff0000" })

    expect(clips().find((c) => c.id === id)?.effects ?? []).toContain(
      "background"
    )
  })

  it("syncs matching clip poses to the optimized value", () => {
    const id = enterAnimateWithOpenClip()
    const sourceUrl = activeCanvas().background.sourceUrl
    // The clip's pose was captured with the pre-optimization background value.
    expect(clips().find((c) => c.id === id)?.pose?.background.sourceUrl).toBe(
      sourceUrl
    )

    const optimized: Background = {
      type: "image",
      value: "data:image/png;base64,optimized",
      sourceUrl,
    }
    store.getState().setBackground(optimized, undefined, { silent: true })

    // Re-selecting the clip reloads its pose onto the canvas; the pose must hold
    // the optimized value so it doesn't revert to the un-downscaled image.
    expect(clips().find((c) => c.id === id)?.pose?.background.value).toBe(
      optimized.value
    )
  })
})
