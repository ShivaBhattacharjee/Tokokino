import { describe, expect, it } from "vitest"

import {
  liveClipCount,
  payloadClipCount,
  resolvePresetAnimateIntent,
} from "@/lib/editor/animation-presence"
import { createCanvas, DEFAULT_STATE } from "@/lib/editor/store/defaults"
import type { AnimationClip, EditorState } from "@/lib/editor/state-types"

const clip = (id: string): AnimationClip => ({
  id,
  startMs: 0,
  durationMs: 1000,
  target: { scope: "all" },
  effects: [],
})

describe("payloadClipCount", () => {
  it("counts clips across every carrier", () => {
    expect(
      payloadClipCount([
        { animation: { clips: [clip("a"), clip("b")] } },
        { animation: { clips: [clip("c")] } },
      ])
    ).toBe(3)
  })

  it("reads zero from payloads a normaliser would silently empty", () => {
    expect(payloadClipCount(undefined)).toBe(0)
    expect(payloadClipCount([])).toBe(0)
    expect(payloadClipCount([undefined, null])).toBe(0)
    expect(payloadClipCount([{}])).toBe(0)
    expect(payloadClipCount([{ animation: { clips: [] } }])).toBe(0)
  })

  it("accepts the real payloads its callers hand it", () => {
    const canvas = {
      ...createCanvas("a"),
      animation: { durationMs: 4000, clips: [clip("one")] },
    }
    const presetGeometry = {
      canvasTilt: { rx: 0, ry: 0, rz: 0 },
      canvasScale: 100,
      slots: [],
      animation: { durationMs: 4000, clips: [clip("two")], sourceSlotIds: [] },
    }

    expect(payloadClipCount([canvas])).toBe(1)
    expect(payloadClipCount([presetGeometry])).toBe(1)
  })

  it("counts a timeline the store's normaliser would refuse", () => {
    // `clips` that isn't an array survives the count but not the load — the
    // mismatch these helpers exist to surface. Arrives as it does in reality:
    // parsed JSON nobody has validated.
    const payload: unknown = JSON.parse(
      '[{"animation":{"clips":{"length":3}}}]'
    )

    expect(
      payloadClipCount(payload as Parameters<typeof payloadClipCount>[0])
    ).toBe(3)
  })
})

describe("liveClipCount", () => {
  const stateWith = (
    canvases: EditorState["canvases"],
    activeCanvasId: string
  ): EditorState => ({ ...DEFAULT_STATE, canvases, activeCanvasId })

  it("counts only the canvas the user is looking at", () => {
    const active = {
      ...createCanvas("a"),
      animation: { durationMs: 5000, clips: [clip("one"), clip("two")] },
    }
    const other = {
      ...createCanvas("b"),
      animation: { durationMs: 5000, clips: [clip("three")] },
    }

    expect(liveClipCount(stateWith([active, other], "a"))).toBe(2)
    expect(liveClipCount(stateWith([active, other], "b"))).toBe(1)
  })

  it("is zero for a canvas with no timeline", () => {
    const canvas = createCanvas("a")
    expect(liveClipCount(stateWith([canvas], "a"))).toBe(0)
    expect(liveClipCount(stateWith([canvas], "missing"))).toBe(0)
  })
})

describe("resolvePresetAnimateIntent", () => {
  const withClips = { animation: { durationMs: 4000, clips: [clip("a")] } }

  it("animates a preset that still has its timeline", () => {
    expect(resolvePresetAnimateIntent("animate", withClips)).toBe("animate")
  })

  it("animates a style-typed preset that carries clips anyway", () => {
    // Predates the animate type; the clips are what actually decide.
    expect(resolvePresetAnimateIntent("style", withClips)).toBe("animate")
  })

  it("flags an animate preset whose timeline is gone", () => {
    expect(resolvePresetAnimateIntent("animate", {})).toBe("missing-timeline")
    expect(
      resolvePresetAnimateIntent("animate", {
        animation: { durationMs: 4000, clips: [] },
      })
    ).toBe("missing-timeline")
  })

  it("leaves an ordinary style preset alone", () => {
    expect(resolvePresetAnimateIntent("style", {})).toBe("style")
    expect(resolvePresetAnimateIntent(undefined, {})).toBe("style")
  })
})
