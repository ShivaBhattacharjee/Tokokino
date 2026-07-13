import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore

const videoClips = () => {
  const state = store.getState().present
  return state.canvases.find((canvas) => canvas.id === state.activeCanvasId)!
    .videoClips
}

const initializeVideoClip = () => {
  store.getState().updateVideoClip("video-main", { endMs: 5_000 })
  return videoClips()![0]
}

describe("video timeline store actions", () => {
  beforeEach(() => store.getState().reset())

  it("creates an editable main video section on first update", () => {
    const clip = initializeVideoClip()

    expect(clip).toMatchObject({
      id: "video-main",
      timelineStartMs: 0,
      startMs: 0,
      endMs: 5_000,
    })
  })

  it("splits a section into contiguous source and timeline ranges", () => {
    initializeVideoClip()

    const secondId = store.getState().splitVideoClip("video-main", 2_000)
    const [first, second] = videoClips()!

    expect(secondId).toBeTruthy()
    expect(first).toMatchObject({
      startMs: 0,
      endMs: 2_000,
      timelineStartMs: 0,
    })
    expect(second).toMatchObject({
      id: secondId,
      startMs: 2_000,
      endMs: 5_000,
      timelineStartMs: 2_000,
    })
  })

  it("refuses cuts on a section boundary", () => {
    initializeVideoClip()

    expect(store.getState().splitVideoClip("video-main", 0)).toBeNull()
    expect(store.getState().splitVideoClip("video-main", 5_000)).toBeNull()
    expect(videoClips()).toHaveLength(1)
  })

  it("keeps mute state isolated to the updated section", () => {
    initializeVideoClip()
    const secondId = store.getState().splitVideoClip("video-main", 2_000)!

    store.getState().updateVideoClip(secondId, { muted: true })

    const [first, second] = videoClips()!
    expect(first.muted).toBeUndefined()
    expect(second.muted).toBe(true)
  })

  it("duplicates a section after its source and materializes an open-ended range", () => {
    // An unsplit source has no explicit end until the timeline knows its media
    // length. Duplicate receives that resolved duration from the UI.
    const duplicatedId = store
      .getState()
      .duplicateVideoClip("video-main", 5_000)
    const [original, duplicate] = videoClips()!

    expect(duplicatedId).toBeTruthy()
    expect(original.endMs).toBe(5_000)
    expect(duplicate).toMatchObject({
      id: duplicatedId,
      startMs: 0,
      endMs: 5_000,
      timelineStartMs: 5_000,
    })
  })

  it("inserts a duplicate into the next occupied position and ripples its successor", () => {
    initializeVideoClip()
    const secondId = store.getState().splitVideoClip("video-main", 2_000)!

    const duplicatedId = store
      .getState()
      .duplicateVideoClip("video-main", 2_000)!
    const clips = videoClips()!
    const duplicate = clips.find((clip) => clip.id === duplicatedId)!
    const successor = clips.find((clip) => clip.id === secondId)!

    expect(duplicate.timelineStartMs).toBe(2_000)
    expect(successor.timelineStartMs).toBe(4_000)
  })

  it("deletes only the requested section and restores it with undo", () => {
    initializeVideoClip()
    const secondId = store.getState().splitVideoClip("video-main", 2_000)!

    store.getState().removeVideoClips([secondId])
    expect(videoClips()).toHaveLength(1)

    store.getState().undo()
    expect(videoClips()).toHaveLength(2)
  })

  it("clears the canvas media when the last section is deleted", () => {
    initializeVideoClip()

    store.getState().removeVideoClips(["video-main"])

    const state = store.getState().present
    const canvas = state.canvases.find(
      (item) => item.id === state.activeCanvasId
    )!
    expect(canvas.screenshot).toBeNull()
    expect(canvas.videoClips).toBeNull()
  })
})
