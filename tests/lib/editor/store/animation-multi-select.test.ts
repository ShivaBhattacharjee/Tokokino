import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"

const store = useEditorStore

const clips = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!.animation!.clips
}
const clipById = (id: string) => clips().find((c) => c.id === id)
// Append `n` clips (each lands after the last, so they never overlap) and
// return their ids in creation order.
const addClips = (n: number) =>
  Array.from({ length: n }, () => store.getState().addAnimationClip())

describe("animation clip multi-selection", () => {
  beforeEach(() => store.getState().reset())

  describe("setAnimationClipSelection", () => {
    it("selects several clips as a group and opens no single keyframe", () => {
      const [a, b, c] = addClips(3)
      store.getState().setAnimationClipSelection([a, b, c])

      expect(store.getState().selectedAnimationClipIds).toEqual([a, b, c])
      // A multi-selection opens no single clip for editing, so inspector edits
      // can't mis-route onto one keyframe.
      expect(store.getState().selectedAnimationClipId).toBeNull()
    })

    it("de-duplicates repeated ids", () => {
      const [a, b] = addClips(2)
      store.getState().setAnimationClipSelection([a, a, b, b, a])
      expect(store.getState().selectedAnimationClipIds).toEqual([a, b])
    })

    it("with a single id behaves like a normal select (opens it)", () => {
      const [, b] = addClips(2)
      store.getState().setAnimationClipSelection([b])

      expect(store.getState().selectedAnimationClipIds).toEqual([b])
      expect(store.getState().selectedAnimationClipId).toBe(b)
    })

    it("with an empty list deselects everything", () => {
      const [a, b] = addClips(2)
      store.getState().setAnimationClipSelection([a, b])
      store.getState().setAnimationClipSelection([])

      expect(store.getState().selectedAnimationClipIds).toEqual([])
      expect(store.getState().selectedAnimationClipId).toBeNull()
    })

    it("persists the open clip's live edits before clearing the primary", () => {
      const [a, b] = addClips(2)
      store.getState().setIsAnimateMode(true)
      // Open clip A and animate the padding on it (records the live pose).
      store.getState().selectAnimationClip(a)
      store.getState().setPadding(160)

      // Switching to a multi-selection must not lose A's committed pose.
      store.getState().setAnimationClipSelection([a, b])
      expect(clipById(a)!.pose?.padding).toBe(160)
    })
  })

  describe("selectAnimationClip keeps the selection set in sync", () => {
    it("collapses a multi-selection down to the clicked clip", () => {
      const [a, b, c] = addClips(3)
      store.getState().setAnimationClipSelection([a, b, c])

      store.getState().selectAnimationClip(b)
      expect(store.getState().selectedAnimationClipIds).toEqual([b])
      expect(store.getState().selectedAnimationClipId).toBe(b)
    })

    it("a single select makes the set exactly that clip", () => {
      const [a] = addClips(1)
      store.getState().selectAnimationClip(a)
      expect(store.getState().selectedAnimationClipIds).toEqual([a])
    })

    it("deselecting (null) clears the set and the primary", () => {
      const [a] = addClips(1)
      store.getState().selectAnimationClip(a)
      store.getState().selectAnimationClip(null)

      expect(store.getState().selectedAnimationClipIds).toEqual([])
      expect(store.getState().selectedAnimationClipId).toBeNull()
    })
  })

  describe("removeAnimationClips", () => {
    it("deletes every clip in the list in one call", () => {
      const [a, b, c] = addClips(3)
      store.getState().removeAnimationClips([a, c])
      expect(clips().map((cl) => cl.id)).toEqual([b])
    })

    it("prunes the removed ids from the selection", () => {
      const [a, b, c] = addClips(3)
      store.getState().setAnimationClipSelection([a, b, c])
      store.getState().removeAnimationClips([a, b])
      expect(store.getState().selectedAnimationClipIds).toEqual([c])
    })

    it("clears the primary when it was among those removed", () => {
      const [a] = addClips(1)
      store.getState().selectAnimationClip(a) // primary = a
      store.getState().removeAnimationClips([a])
      expect(store.getState().selectedAnimationClipId).toBeNull()
    })

    it("undoes the whole bulk delete in a single step", () => {
      addClips(3)
      const ids = clips().map((c) => c.id)
      store.getState().removeAnimationClips(ids)
      expect(clips()).toHaveLength(0)

      store.getState().undo()
      expect(clips().map((c) => c.id)).toEqual(ids)
    })

    it("ignores an empty id list", () => {
      addClips(2)
      store.getState().removeAnimationClips([])
      expect(clips()).toHaveLength(2)
    })
  })

  describe("duplicateAnimationClips", () => {
    it("returns a fresh id per source and doubles the clip count", () => {
      const [a, b] = addClips(2)
      const newIds = store.getState().duplicateAnimationClips([a, b])

      expect(newIds).toHaveLength(2)
      expect(clips()).toHaveLength(4)
      // The copies are new clips distinct from their sources...
      expect(newIds).not.toContain(a)
      expect(newIds).not.toContain(b)
      // ...and every new id actually exists on the timeline.
      for (const id of newIds) expect(clipById(id)).toBeDefined()
    })

    it("returns an empty array for an empty list and changes nothing", () => {
      addClips(1)
      expect(store.getState().duplicateAnimationClips([])).toEqual([])
      expect(clips()).toHaveLength(1)
    })

    it("skips ids that no longer exist", () => {
      const [a] = addClips(1)
      const newIds = store.getState().duplicateAnimationClips([a, "missing"])
      expect(newIds).toHaveLength(1)
      expect(clips()).toHaveLength(2)
    })

    it("undoes the whole bulk duplicate in a single step", () => {
      const [a, b] = addClips(2)
      store.getState().duplicateAnimationClips([a, b])
      expect(clips()).toHaveLength(4)

      store.getState().undo()
      expect(clips().map((c) => c.id)).toEqual([a, b])
    })
  })

  describe("clearAnimationClipsEffects", () => {
    it("strips owned effects from every clip in the list", () => {
      const [a, b] = addClips(2)
      store.getState().setIsAnimateMode(true)
      // Give A a position effect and B a padding effect.
      store.getState().selectAnimationClip(a)
      store.getState().setScreenshotPosition("0-0")
      store.getState().selectAnimationClip(b)
      store.getState().setPadding(120)
      expect(clipById(a)!.effects).toContain("position")
      expect(clipById(b)!.effects).toContain("padding")

      store.getState().clearAnimationClipsEffects([a, b])
      expect(clipById(a)!.effects).toEqual([])
      expect(clipById(b)!.effects).toEqual([])
    })

    it("only clears the listed clips, leaving others' effects intact", () => {
      const [a, b, c] = addClips(3)
      store.getState().setIsAnimateMode(true)
      store.getState().selectAnimationClip(a)
      store.getState().setScreenshotPosition("0-0")
      store.getState().selectAnimationClip(b)
      store.getState().setPadding(120)
      store.getState().selectAnimationClip(c)
      store.getState().setScale(150)

      store.getState().clearAnimationClipsEffects([a, b])
      expect(clipById(a)!.effects).toEqual([])
      expect(clipById(b)!.effects).toEqual([])
      // C wasn't in the list, so it keeps its zoom effect.
      expect(clipById(c)!.effects).toContain("zoom")
    })
  })

  describe("selection invariants across animate mode", () => {
    it("opens the last clip (and syncs the set) on entering animate mode", () => {
      const ids = addClips(3)
      store.getState().setIsAnimateMode(true)

      const last = ids[ids.length - 1]
      expect(store.getState().selectedAnimationClipId).toBe(last)
      expect(store.getState().selectedAnimationClipIds).toEqual([last])
    })

    it("clears the selection set on exiting animate mode", () => {
      const [a, b] = addClips(2)
      store.getState().setIsAnimateMode(true)
      store.getState().setAnimationClipSelection([a, b])

      store.getState().setIsAnimateMode(false)
      expect(store.getState().selectedAnimationClipIds).toEqual([])
      expect(store.getState().selectedAnimationClipId).toBeNull()
    })
  })
})
