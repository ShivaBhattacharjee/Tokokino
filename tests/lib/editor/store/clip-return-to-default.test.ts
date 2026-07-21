import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore

const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}
const clips = () => activeCanvas().animation!.clips
const clipById = (id: string) => clips().find((c) => c.id === id)!

describe("addAnimationClip returnToDefault", () => {
  beforeEach(() => store.getState().reset())

  it("marks new clips as returning to default explicitly", () => {
    const id = store.getState().addAnimationClip()
    // Explicit `true`, not undefined: undefined is the legacy hold, so relying
    // on the default would silently change how old drafts play.
    expect(clipById(id).returnToDefault).toBe(true)
  })

  it("lets a clip be switched back to holding its pose", () => {
    const id = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(id, { returnToDefault: false })
    expect(clipById(id).returnToDefault).toBe(false)
  })

  it("carries the choice onto both halves of a split", () => {
    const id = store.getState().addAnimationClip()
    const source = clipById(id)
    const newId = store
      .getState()
      .splitAnimationClip(id, source.startMs + source.durationMs / 2)
    expect(newId).not.toBeNull()
    expect(clipById(id).returnToDefault).toBe(true)
    expect(clipById(newId!).returnToDefault).toBe(true)
  })
})
