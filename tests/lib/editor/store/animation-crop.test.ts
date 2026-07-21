import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import type { CropRegion } from "@/lib/editor/state-types"

/**
 * Per-keyframe video crop. Crop is an ordinary `AnimationEffect`, so it inherits
 * the pose-chain model: editing it with a clip open claims the effect on THAT
 * clip, and the value lands in the clip's pose when the selection moves on (the
 * open clip's live edits live on the canvas until then — same as padding/zoom).
 * See `animation-playback.test.ts` for the interpolation and hold-past-end.
 */
const store = useEditorStore

const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}
const clips = () => activeCanvas().animation!.clips
const clipById = (id: string) => clips().find((c) => c.id === id)
const addClips = (n: number) =>
  Array.from({ length: n }, () => store.getState().addAnimationClip())

const TIGHT: CropRegion = { x: 20, y: 10, width: 50, height: 60 }
const WIDE: CropRegion = { x: 5, y: 5, width: 90, height: 90 }

describe("per-keyframe video crop", () => {
  beforeEach(() => store.getState().reset())

  it("claims the crop effect on the open clip", () => {
    const [a] = addClips(1)
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(a)

    store.getState().setScreenshotCropRegion(TIGHT)

    expect(clipById(a)!.effects).toContain("crop")
    expect(activeCanvas().lastCropRegion).toEqual(TIGHT)
  })

  it("persists the crop into the clip's pose once the selection moves on", () => {
    const [a, b] = addClips(2)
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(a)
    store.getState().setScreenshotCropRegion(TIGHT)

    store.getState().selectAnimationClip(b)

    expect(clipById(a)!.pose?.crop).toEqual(TIGHT)
  })

  it("keeps each clip's crop independent", () => {
    const [a, b] = addClips(2)
    store.getState().setIsAnimateMode(true)

    store.getState().selectAnimationClip(a)
    store.getState().setScreenshotCropRegion(TIGHT)
    store.getState().selectAnimationClip(b)
    store.getState().setScreenshotCropRegion(WIDE)
    store.getState().selectAnimationClip(null)

    // The whole point of the feature: cropping on b must not reach back into a.
    expect(clipById(a)!.pose?.crop).toEqual(TIGHT)
    expect(clipById(b)!.pose?.crop).toEqual(WIDE)
  })

  it("restores a clip's crop onto the canvas when that clip is reopened", () => {
    const [a, b] = addClips(2)
    store.getState().setIsAnimateMode(true)

    store.getState().selectAnimationClip(a)
    store.getState().setScreenshotCropRegion(TIGHT)
    store.getState().selectAnimationClip(b)
    store.getState().setScreenshotCropRegion(WIDE)

    store.getState().selectAnimationClip(a)
    expect(activeCanvas().lastCropRegion).toEqual(TIGHT)
    store.getState().selectAnimationClip(b)
    expect(activeCanvas().lastCropRegion).toEqual(WIDE)
  })

  it("stays a plain committed edit when no keyframe is open", () => {
    const [a] = addClips(1)
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(null)

    store.getState().setScreenshotCropRegion(TIGHT)

    expect(activeCanvas().lastCropRegion).toEqual(TIGHT)
    expect(clipById(a)!.effects ?? []).not.toContain("crop")
  })

  it("stays a plain committed edit outside animate mode", () => {
    const [a] = addClips(1)
    store.getState().setIsAnimateMode(false)

    store.getState().setScreenshotCropRegion(TIGHT)

    expect(activeCanvas().lastCropRegion).toEqual(TIGHT)
    expect(clipById(a)!.effects ?? []).not.toContain("crop")
  })

  it("records a cleared crop rather than keeping the stale rect", () => {
    const [a, b] = addClips(2)
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(a)

    store.getState().setScreenshotCropRegion(TIGHT)
    store.getState().setScreenshotCropRegion(null)
    store.getState().selectAnimationClip(b)

    // Reopening the clip must not resurrect a crop the user removed.
    expect(clipById(a)!.pose?.crop ?? null).toBeNull()
    store.getState().selectAnimationClip(a)
    expect(activeCanvas().lastCropRegion).toBeNull()
  })

  it("drops the crop effect when a clip's effects are cleared", () => {
    const [a] = addClips(1)
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(a)
    store.getState().setScreenshotCropRegion(TIGHT)

    store.getState().clearAnimationClipsEffects([a])

    expect(clipById(a)!.effects).toEqual([])
  })

  it("writes only crop into a multi-selection, leaving sibling pose fields", () => {
    const [a, b] = addClips(2)
    store.getState().setIsAnimateMode(true)

    // Give each clip its own padding first, then crop them together.
    store.getState().selectAnimationClip(a)
    store.getState().setPadding(120)
    store.getState().selectAnimationClip(b)
    store.getState().setPadding(200)

    store.getState().setAnimationClipSelection([a, b])
    store.getState().setScreenshotCropRegion(TIGHT)

    expect(clipById(a)!.pose?.crop).toEqual(TIGHT)
    expect(clipById(b)!.pose?.crop).toEqual(TIGHT)
    // Each clip keeps the padding it already had.
    expect(clipById(a)!.pose?.padding).toBe(120)
    expect(clipById(b)!.pose?.padding).toBe(200)
  })
})
