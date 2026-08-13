import { beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_BACKDROP_ASCII,
  resolveBackdropAscii,
} from "@/lib/editor/ascii-backdrop"
import { useEditorStore } from "@/lib/editor/store"
import { createCanvas } from "@/lib/editor/store/defaults"
import { normalizeEditorState } from "@/lib/editor/store/draft-persistence"

const store = useEditorStore

const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

describe("setBackdropAscii", () => {
  beforeEach(() => store.getState().reset())

  it("writes the ASCII settings onto the active canvas and is undoable", () => {
    store.getState().setBackdropAscii({
      ...DEFAULT_BACKDROP_ASCII,
      enabled: true,
      charset: "blocks",
      resolution: 140,
    })

    expect(activeCanvas().backdrop.ascii).toMatchObject({
      enabled: true,
      charset: "blocks",
      resolution: 140,
    })

    store.getState().undo()
    expect(activeCanvas().backdrop.ascii?.enabled).toBe(false)
  })

  it("leaves the rest of the backdrop untouched", () => {
    store.getState().setBackdropPattern({
      ids: [2],
      intensity: 70,
      thickness: 2,
      color: "#FF0000",
    })
    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, enabled: true })

    const { backdrop } = activeCanvas()
    expect(backdrop.pattern).toMatchObject({ ids: [2], intensity: 70 })
    expect(backdrop.ascii?.enabled).toBe(true)
  })

  it("targets a specific canvas when one is named", () => {
    const otherId = store.getState().addCanvas()
    expect(otherId).toBeTruthy()
    const firstId = store.getState().present.canvases[0].id
    store.getState().setActiveCanvasId(firstId)

    store
      .getState()
      .setBackdropAscii(
        { ...DEFAULT_BACKDROP_ASCII, enabled: true },
        otherId ?? undefined
      )

    const canvases = store.getState().present.canvases
    expect(
      canvases.find((c) => c.id === otherId)?.backdrop.ascii?.enabled
    ).toBe(true)
    expect(
      canvases.find((c) => c.id === firstId)?.backdrop.ascii?.enabled
    ).toBe(false)
  })
})

describe("ascii resolution validation", () => {
  beforeEach(() => store.getState().reset())

  it("clamps and rounds whatever the UI hands the store", () => {
    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, resolution: 9999 })
    expect(activeCanvas().backdrop.ascii?.resolution).toBe(200)

    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, resolution: 4 })
    expect(activeCanvas().backdrop.ascii?.resolution).toBe(20)

    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, resolution: 88.7 })
    expect(activeCanvas().backdrop.ascii?.resolution).toBe(89)
  })
})

describe("ascii in animate mode", () => {
  beforeEach(() => store.getState().reset())

  it("registers the open keyframe as owning the effect", () => {
    const clipId = store.getState().addAnimationClip()
    store.getState().setIsAnimateMode(true)
    store.getState().selectAnimationClip(clipId)

    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, enabled: true })

    // The open keyframe reads its value from the committed canvas (poses are
    // resolved later) — ownership is what makes it animate at all.
    const clip = activeCanvas().animation?.clips.find((c) => c.id === clipId)
    expect(clip?.effects ?? []).toContain("ascii")
    expect(activeCanvas().backdrop.ascii?.enabled).toBe(true)
  })

  it("captures ASCII in a clip's baseline so it eases from the committed look", () => {
    store
      .getState()
      .setBackdropAscii({ ...DEFAULT_BACKDROP_ASCII, charset: "blocks" })
    const clipId = store.getState().addAnimationClip()

    const clip = activeCanvas().animation?.clips.find((c) => c.id === clipId)
    expect(clip?.baseline?.ascii?.charset).toBe("blocks")
  })
})

describe("ascii backdrop draft hydration", () => {
  it("fills in the defaults for drafts saved before ASCII existed", () => {
    const canvas = createCanvas("legacy", { x: 0, y: 0 })
    const { ascii: _dropped, ...legacyBackdrop } = canvas.backdrop

    const normalized = normalizeEditorState({
      activeCanvasId: "legacy",
      canvases: [{ ...canvas, backdrop: legacyBackdrop }],
    })

    expect(normalized.canvases[0]?.backdrop.ascii).toEqual(
      DEFAULT_BACKDROP_ASCII
    )
  })

  it("keeps saved ASCII settings and backfills fields added later", () => {
    const canvas = createCanvas("saved", { x: 0, y: 0 })
    const normalized = normalizeEditorState({
      activeCanvasId: "saved",
      canvases: [
        {
          ...canvas,
          backdrop: {
            ...canvas.backdrop,
            ascii: { enabled: true, charset: "dots" } as never,
          },
        },
      ],
    })

    expect(normalized.canvases[0]?.backdrop.ascii).toEqual(
      resolveBackdropAscii({ enabled: true, charset: "dots" } as never)
    )
  })
})
