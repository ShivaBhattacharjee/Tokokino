import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import { MAX_DURATION_MS } from "@/lib/editor/animation-timeline"

/**
 * The timeline's Duplicate actions can decline, and the UI now reports that
 * instead of leaving the menu looking broken. These pin the store contract the
 * toasts read: an empty id list / a null id is the refusal signal.
 */
const store = useEditorStore

const clips = () => {
  const state = store.getState().present
  return state.canvases.find((c) => c.id === state.activeCanvasId)!.animation!
    .clips
}

describe("duplicateAnimationClips refusals", () => {
  beforeEach(() => store.getState().reset())

  it("duplicates a real keyframe", () => {
    const id = store.getState().addAnimationClip()

    const newIds = store.getState().duplicateAnimationClips([id])

    expect(newIds).toHaveLength(1)
    expect(clips()).toHaveLength(2)
  })

  it("returns nothing for an empty selection", () => {
    expect(store.getState().duplicateAnimationClips([])).toEqual([])
  })

  it("returns nothing for ids that are not on this canvas", () => {
    store.getState().addAnimationClip()

    expect(store.getState().duplicateAnimationClips(["ghost"])).toEqual([])
    expect(clips()).toHaveLength(1)
  })

  it("returns nothing when the canvas does not exist", () => {
    const id = store.getState().addAnimationClip()

    expect(store.getState().duplicateAnimationClips([id], "missing")).toEqual(
      []
    )
  })

  it("refuses a copy when later clips cannot ripple without overlap", () => {
    const sourceId = store.getState().addAnimationClip()
    const laterId = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(sourceId, {
      startMs: MAX_DURATION_MS - 2_000,
      durationMs: 1_000,
    })
    store.getState().updateAnimationClip(laterId, {
      startMs: MAX_DURATION_MS - 1_000,
      durationMs: 1_000,
    })

    expect(store.getState().duplicateAnimationClip(sourceId)).toBeNull()
    expect(clips()).toHaveLength(2)
    expect(clips().find((clip) => clip.id === laterId)?.startMs).toBe(
      MAX_DURATION_MS - 1_000
    )
  })

  it("skips saturated clips in bulk duplication", () => {
    const sourceId = store.getState().addAnimationClip()
    const laterId = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(sourceId, {
      startMs: MAX_DURATION_MS - 2_000,
      durationMs: 1_000,
    })
    store.getState().updateAnimationClip(laterId, {
      startMs: MAX_DURATION_MS - 1_000,
      durationMs: 1_000,
    })

    expect(store.getState().duplicateAnimationClips([sourceId])).toEqual([])
    expect(clips()).toHaveLength(2)
  })

  it("refuses the whole bulk duplicate when any selected clip cannot fit", () => {
    const firstId = store.getState().addAnimationClip()
    const saturatedId = store.getState().addAnimationClip()
    store.getState().updateAnimationClip(firstId, {
      startMs: 0,
      durationMs: 1_000,
    })
    store.getState().updateAnimationClip(saturatedId, {
      startMs: MAX_DURATION_MS - 1_000,
      durationMs: 1_000,
    })

    expect(
      store.getState().duplicateAnimationClips([firstId, saturatedId])
    ).toEqual([])
    expect(clips().map((clip) => clip.id)).toEqual([firstId, saturatedId])
  })
})

describe("duplicateVideoClip refusals", () => {
  beforeEach(() => store.getState().reset())

  it("duplicates a section of known length", () => {
    store.getState().updateVideoClip("video-main", { endMs: 5_000 })

    expect(
      store.getState().duplicateVideoClip("video-main", 5_000)
    ).toBeTruthy()
  })

  it("returns null for a section whose media has no duration yet", () => {
    store.getState().updateVideoClip("video-main", { endMs: 5_000 })

    expect(store.getState().duplicateVideoClip("video-main", 0)).toBeNull()
  })

  it("returns null for a section that is not there", () => {
    store.getState().updateVideoClip("video-main", { endMs: 5_000 })

    expect(store.getState().duplicateVideoClip("ghost", 5_000)).toBeNull()
  })
})
