import { beforeEach, describe, expect, it } from "vitest"

import {
  applyAnimationFrameAtTime,
  clearAnimationFrameVars,
} from "@/lib/editor/apply-animation-frame"
import {
  asciiLayerOpacityVar,
  ASCII_BASE_OPACITY_VAR,
} from "@/lib/editor/animation-playback"
import { DEFAULT_BACKDROP_ASCII } from "@/lib/editor/ascii-backdrop"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type { AnimationClip, CanvasState } from "@/lib/editor/state-types"

const baseCanvas = (): CanvasState => {
  const s = useEditorStore.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

const asciiClip = (
  id: string,
  startMs: number,
  effects: AnimationClip["effects"] = ["ascii"]
): AnimationClip => {
  const canvas = baseCanvas()
  const pose = captureClipPose(canvas)
  return {
    id,
    startMs,
    durationMs: 1000,
    target: { scope: "main" },
    effects,
    easing: "linear",
    baseline: { ...pose, ascii: DEFAULT_BACKDROP_ASCII },
    pose: { ...pose, ascii: { ...DEFAULT_BACKDROP_ASCII, enabled: true } },
  }
}

const applyAt = (el: HTMLElement, clips: AnimationClip[], timeMs: number) =>
  applyAnimationFrameAtTime({
    canvasEl: el,
    canvas: baseCanvas(),
    globalAspect: { id: "auto", w: 16, h: 9 },
    clips,
    timeMs,
  })

const num = (el: HTMLElement, name: string) =>
  Number(el.style.getPropertyValue(name))

describe("animated ASCII → crossfade vars", () => {
  let el: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("fades the base out as the first keyframe fades in", () => {
    const clip = asciiClip("k1", 0)

    applyAt(el, [clip], 0)
    expect(num(el, ASCII_BASE_OPACITY_VAR)).toBe(1)
    expect(num(el, asciiLayerOpacityVar("k1"))).toBe(0)

    applyAt(el, [clip], 1000)
    expect(num(el, ASCII_BASE_OPACITY_VAR)).toBe(0)
    expect(num(el, asciiLayerOpacityVar("k1"))).toBe(1)
  })

  it("chains keyframes so an earlier layer eases out under the next", () => {
    const first = asciiClip("k1", 0)
    const second = asciiClip("k2", 1000)

    // Mid-way through the second keyframe: the first is on its way out and the
    // second on its way in — never both fully opaque, never both gone.
    applyAt(el, [first, second], 1500)
    const out = num(el, asciiLayerOpacityVar("k1"))
    const incoming = num(el, asciiLayerOpacityVar("k2"))
    expect(out).toBeGreaterThan(0)
    expect(out).toBeLessThan(1)
    expect(incoming).toBeGreaterThan(0)
    expect(incoming).toBeLessThan(1)

    // Past the end the last keyframe holds and the earlier one is gone.
    applyAt(el, [first, second], 2000)
    expect(num(el, asciiLayerOpacityVar("k1"))).toBe(0)
    expect(num(el, asciiLayerOpacityVar("k2"))).toBe(1)
  })

  it("gives a background keyframe its own ASCII layer", () => {
    const asciiK = asciiClip("k1", 0)
    const bgK = asciiClip("bg", 1000, ["background"])

    applyAt(el, [asciiK, bgK], 2000)
    // The background swap drives its own layer, so the glyphs re-render for the
    // new background instead of holding the previous one.
    expect(num(el, asciiLayerOpacityVar("bg"))).toBe(1)
    expect(num(el, asciiLayerOpacityVar("k1"))).toBe(0)
  })

  it("clears every ASCII var at rest so the committed backdrop shows", () => {
    const clip = asciiClip("k1", 0)
    applyAt(el, [clip], 1000)
    clearAnimationFrameVars(el, [clip])

    expect(el.style.getPropertyValue(ASCII_BASE_OPACITY_VAR)).toBe("")
    expect(el.style.getPropertyValue(asciiLayerOpacityVar("k1"))).toBe("")
  })
})
