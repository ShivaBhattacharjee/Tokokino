import { beforeEach, describe, expect, it } from "vitest"

import { applyAnimationFrameAtTime } from "@/lib/editor/apply-animation-frame"
import { FULL_CROP_REGION } from "@/lib/editor/animation-playback"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type { AnimationClip, CanvasState } from "@/lib/editor/state-types"

/**
 * The CSS vars an animated crop drives. Both render paths get a var because
 * browser support for `object-view-box` differs: Chromium reads --crop-view-box,
 * the Firefox/Safari polyfill reads the four box metrics. See `crop-utils.ts`.
 */
const VIEW_BOX = "--crop-view-box"
const METRICS = ["--crop-w", "--crop-h", "--crop-left", "--crop-top"] as const

const baseCanvas = (): CanvasState => {
  const s = useEditorStore.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

const cropClip = (over: Partial<AnimationClip> = {}): AnimationClip => {
  const canvas = baseCanvas()
  return {
    id: "clip-crop",
    startMs: 0,
    durationMs: 1000,
    effects: ["crop"],
    easing: "linear",
    baseline: { ...captureClipPose(canvas), crop: FULL_CROP_REGION },
    pose: {
      ...captureClipPose(canvas),
      crop: { x: 20, y: 20, width: 60, height: 60 },
    },
    ...over,
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

describe("animated crop → CSS vars", () => {
  let el: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("writes every crop var so both render paths follow the animation", () => {
    applyAt(el, [cropClip()], 1000)

    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(20% 20% 20% 20%)")
    for (const name of METRICS) {
      expect(el.style.getPropertyValue(name)).not.toBe("")
    }
  })

  it("starts from the full frame when the clip reveals from uncropped", () => {
    applyAt(el, [cropClip()], 0)

    // Progress 0 → the baseline's full-frame rect, i.e. no visible crop.
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(0% 0% 0% 0%)")
    expect(el.style.getPropertyValue("--crop-w")).toBe("100%")
    expect(el.style.getPropertyValue("--crop-left")).toBe("0%")
  })

  it("eases the source rect through the middle of the clip", () => {
    applyAt(el, [cropClip()], 500)

    // Linear easing, halfway: x/y 0→20 lands on 10, width/height 100→60 on 80.
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(10% 10% 10% 10%)")
  })

  it("holds the last crop past the end of the clip", () => {
    const clips = [cropClip()]
    applyAt(el, clips, 1000)
    const atEnd = el.style.getPropertyValue(VIEW_BOX)

    applyAt(el, clips, 9999)

    // Hold semantics: a crop persists until another clip changes it, matching
    // every other animated property.
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe(atEnd)
  })

  it("chains from one crop clip to the next instead of snapping back", () => {
    const first = cropClip()
    const second: AnimationClip = {
      ...cropClip(),
      id: "clip-crop-2",
      startMs: 1000,
      durationMs: 1000,
      pose: {
        ...captureClipPose(baseCanvas()),
        crop: FULL_CROP_REGION,
      },
    }

    applyAt(el, [first, second], 1500)

    // Halfway back out: 20 → 0 lands on 10, not an instant jump to uncropped.
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(10% 10% 10% 10%)")
  })

  it("clears every crop var when no clip animates the crop", () => {
    applyAt(el, [cropClip()], 1000)
    expect(el.style.getPropertyValue(VIEW_BOX)).not.toBe("")

    const noCrop: AnimationClip = { ...cropClip(), effects: ["padding"] }
    applyAt(el, [noCrop], 1000)

    // A stale var would keep cropping the media after the effect is removed.
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("")
    for (const name of METRICS) {
      expect(el.style.getPropertyValue(name)).toBe("")
    }
  })

  it("clears the crop vars when the timeline has no clips at all", () => {
    applyAt(el, [cropClip()], 1000)
    applyAt(el, [], 1000)

    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("")
  })
})
