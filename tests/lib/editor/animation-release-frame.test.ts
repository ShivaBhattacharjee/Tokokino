import { beforeEach, describe, expect, it } from "vitest"

import { applyAnimationFrameAtTime } from "@/lib/editor/apply-animation-frame"
import {
  backgroundLayerOpacityVar,
  FULL_CROP_REGION,
} from "@/lib/editor/animation-playback"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type { AnimationClip, CanvasState } from "@/lib/editor/state-types"

/**
 * The release has to reach EVERY effect family, not just the ones sharing the
 * generic keyframe sampler — shadow and the layer crossfades each have their own
 * sampler, and each was a separate hold. This drives the real applicator and
 * asserts the vars unwind, so a new effect that forgets to forward the release
 * fails here rather than shipping as "this one animation doesn't come back".
 */
const baseCanvas = (): CanvasState => {
  const s = useEditorStore.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

const applyAt = (el: HTMLElement, clips: AnimationClip[], timeMs: number) =>
  applyAnimationFrameAtTime({
    canvasEl: el,
    canvas: baseCanvas(),
    globalAspect: { id: "auto", w: 16, h: 9 },
    clips,
    timeMs,
  })

const everythingClip = (over: Partial<AnimationClip> = {}): AnimationClip => {
  const base = captureClipPose(baseCanvas())
  return {
    id: "c1",
    startMs: 0,
    durationMs: 1000,
    easing: "linear",
    effects: [
      "crop",
      "shadow",
      "zoom",
      "tilt",
      "padding",
      "canvasRadius",
      "backdrop",
      "background",
    ],
    baseline: {
      ...base,
      crop: FULL_CROP_REGION,
      padding: 0,
      canvasBorderRadius: 0,
      tilt: { rx: 0, ry: 0, rz: 0 },
      scale: 100,
      shadow: {
        type: "none",
        intensity: 0,
        color: "#000000",
        lightSource: "center",
      },
      backdropEffects: { ...base.backdropEffects, brightness: 100 },
    },
    pose: {
      ...base,
      crop: { x: 20, y: 20, width: 60, height: 60 },
      padding: 120,
      canvasBorderRadius: 40,
      tilt: { rx: 20, ry: 10, rz: 5 },
      scale: 150,
      shadow: {
        type: "soft",
        intensity: 80,
        color: "#000000",
        lightSource: "center",
      },
      backdropEffects: { ...base.backdropEffects, brightness: 150 },
    },
    ...over,
  }
}

// Every var the clip above drives, and what each must read at rest.
const VARS: [name: string, atRest: string][] = [
  ["--crop-view-box", "inset(0% 0% 0% 0%)"],
  ["--canvas-ts-scale", "1"],
  ["--canvas-ts-rx", "0deg"],
  ["--editor-padding-preview", "0.000%"],
  ["--canvas-bd-radius", "0.000px"],
  ["--bd-fx-preview", "brightness(1)"],
  [backgroundLayerOpacityVar("c1"), "0"],
]

describe("release reaches every effect family", () => {
  let el: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("unwinds every animated var back to rest after the clip", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 1000)
    const atPose = VARS.map(([name]) => el.style.getPropertyValue(name))

    // Halfway through the release each var differs from the pose...
    applyAt(el, clips, 1500)
    const midRelease = VARS.map(([name]) => el.style.getPropertyValue(name))
    expect(midRelease).not.toEqual(atPose)

    // ...and by the end every one is back at rest and stays there.
    applyAt(el, clips, 2000)
    for (const [name, atRest] of VARS) {
      expect([name, el.style.getPropertyValue(name)]).toEqual([name, atRest])
    }
    applyAt(el, clips, 99000)
    for (const [name, atRest] of VARS) {
      expect([name, el.style.getPropertyValue(name)]).toEqual([name, atRest])
    }
  })

  it("the release mirrors the reveal — same value in and out", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 500)
    const halfIn = VARS.map(([name]) => el.style.getPropertyValue(name))

    applyAt(el, clips, 1500)
    const halfOut = VARS.map(([name]) => el.style.getPropertyValue(name))

    expect(halfOut).toEqual(halfIn)
  })

  it("the shadow recedes on its own type instead of blinking off", () => {
    const clips = [everythingClip()]
    const scope = el

    applyAt(el, clips, 1000)
    const atPose = scope.style.getPropertyValue("--editor-shadow-preview")

    applyAt(el, clips, 1500)
    const mid = scope.style.getPropertyValue("--editor-shadow-preview")
    expect(mid).not.toBe(atPose)
    expect(mid).not.toBe("none")

    applyAt(el, clips, 2000)
    expect(scope.style.getPropertyValue("--editor-shadow-preview")).toBe("none")
  })

  it("a clip that opts out still holds every var at its pose", () => {
    const clips = [everythingClip({ returnToDefault: false })]

    applyAt(el, clips, 1000)
    const atPose = VARS.map(([name]) => el.style.getPropertyValue(name))

    applyAt(el, clips, 99000)
    expect(VARS.map(([name]) => el.style.getPropertyValue(name))).toEqual(
      atPose
    )
  })
})
