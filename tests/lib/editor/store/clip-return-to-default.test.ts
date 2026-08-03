import { beforeEach, describe, expect, it } from "vitest"

import {
  clipEasingKind,
  clipReturnsToDefault,
  NEW_CLIP_EASING,
} from "@/lib/editor/clip-easing"
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

  it("stores an explicit linear easing so legacy unset still means ease-out", () => {
    const id = store.getState().addAnimationClip()
    const c = clipById(id)
    expect(c.easing).toBe(NEW_CLIP_EASING)
    expect(c.easing).toBe("linear")
    // Unset easing (legacy shape) still resolves to historic ease-out.
    expect(clipEasingKind({})).toBe("out")
  })

  it("clears easingBezier when the transition is patched with undefined", () => {
    const id = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(id, {
      easing: "custom",
      easingBezier: { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9 },
    })
    expect(clipById(id).easingBezier).toEqual({
      x1: 0.2,
      y1: 0.1,
      x2: 0.8,
      y2: 0.9,
    })
    // Same shape as Transition reset — shallow merge must drop the handles.
    store.getState().updateAnimationClip(id, {
      easing: NEW_CLIP_EASING,
      easingBezier: undefined,
    })
    expect(clipById(id).easing).toBe("linear")
    expect(clipById(id).easingBezier).toBeUndefined()
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
