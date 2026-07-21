import { beforeEach, describe, expect, it } from "vitest"

import { clipReturnsToDefault } from "@/lib/editor/clip-easing"
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

  it("returns new clips to default without needing a stored flag", () => {
    const id = store.getState().addAnimationClip()
    expect(clipReturnsToDefault(clipById(id))).toBe(true)
  })

  it("lets a clip be switched back to holding its pose", () => {
    const id = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(id, { returnToDefault: false })
    expect(clipById(id).returnToDefault).toBe(false)
  })

  it("carries an opt-out onto both halves of a split", () => {
    const id = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(id, { returnToDefault: false })
    const source = clipById(id)
    const newId = store
      .getState()
      .splitAnimationClip(id, source.startMs + source.durationMs / 2)
    expect(newId).not.toBeNull()
    expect(clipReturnsToDefault(clipById(id))).toBe(false)
    expect(clipReturnsToDefault(clipById(newId!))).toBe(false)
  })
})
