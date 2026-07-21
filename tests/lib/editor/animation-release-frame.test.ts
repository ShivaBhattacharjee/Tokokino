import { beforeEach, describe, expect, it } from "vitest"

import { applyAnimationFrameAtTime } from "@/lib/editor/apply-animation-frame"
import {
  backgroundLayerOpacityVar,
  DEFAULT_BASELINE,
  filterLayerOpacityVar,
  FULL_CROP_REGION,
  OVERLAY_BASE_OPACITY_VAR,
  overlayLayerOpacityVar,
  PATTERN_BASE_OPACITY_VAR,
  patternLayerOpacityVar,
  PORTRAIT_BASE_OPACITY_VAR,
  portraitLayerOpacityVar,
  REST_LIGHTING,
} from "@/lib/editor/animation-playback"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type {
  AnimationClip,
  AnimationEffect,
  CanvasState,
} from "@/lib/editor/state-types"

/**
 * The release has to reach EVERY effect family, not just the ones sharing the
 * generic keyframe sampler: shadow has its own sampler, and the backdrop layers
 * (background, filter, portrait, pattern, overlay) crossfade through their own
 * opacity vars. Each of those was a separate hold, so this drives the real
 * applicator over the whole union and asserts the frame at the end of the
 * release is the frame at the clip's start — which is what "returns to default"
 * means. An effect that forgets to forward the release fails here rather than
 * shipping as "this one animation doesn't come back".
 */
const ALL_EFFECTS: AnimationEffect[] = [
  "position",
  "zoom",
  "tilt",
  "padding",
  "shadow",
  "background",
  "backdrop",
  "canvasRadius",
  "lighting",
  "filter",
  "portrait",
  "pattern",
  "overlay",
  "border",
  "borderRadius",
  "crop",
]

/** Every var the clip below drives, across all of those sampling paths. */
const VARS = [
  "--crop-view-box",
  "--canvas-ts-scale",
  "--canvas-ts-rx",
  "--canvas-ts-ry",
  "--canvas-ts-rz",
  "--editor-padding-preview",
  "--canvas-bd-radius",
  "--bd-fx-preview",
  "--bd-noise-opacity",
  "--editor-screenshot-radius",
  "--editor-border-outline-preview",
  "--editor-border-offset-preview",
  "--editor-shadow-preview",
  "--bd-light-op",
  "--bd-light-img",
  "--bd-light-op-in",
  "--bd-light-img-in",
  backgroundLayerOpacityVar("c1"),
  filterLayerOpacityVar("c1"),
  portraitLayerOpacityVar("c1"),
  PORTRAIT_BASE_OPACITY_VAR,
  patternLayerOpacityVar("c1"),
  PATTERN_BASE_OPACITY_VAR,
  overlayLayerOpacityVar("c1"),
  OVERLAY_BASE_OPACITY_VAR,
]

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

const readVars = (el: HTMLElement) =>
  Object.fromEntries(VARS.map((v) => [v, el.style.getPropertyValue(v)]))

/** A clip animating every effect from a neutral baseline to a loud pose. */
const everythingClip = (over: Partial<AnimationClip> = {}): AnimationClip => {
  const base = captureClipPose(baseCanvas())
  const lighting = base.lighting ?? REST_LIGHTING
  const portrait = base.portrait ?? DEFAULT_BASELINE.portrait!
  const pattern = base.pattern ?? DEFAULT_BASELINE.pattern!
  const overlay = base.overlay ?? DEFAULT_BASELINE.overlay!
  return {
    id: "c1",
    startMs: 0,
    durationMs: 1000,
    easing: "linear",
    effects: ALL_EFFECTS,
    baseline: {
      ...base,
      crop: FULL_CROP_REGION,
      padding: 0,
      canvasBorderRadius: 0,
      tilt: { rx: 0, ry: 0, rz: 0 },
      scale: 100,
      screenshotOffset: { x: 0, y: 0 },
      shadow: {
        type: "none",
        intensity: 0,
        color: "#000000",
        lightSource: "center",
      },
      backdropEffects: { ...base.backdropEffects, brightness: 100, noise: 0 },
      border: { color: "#ffffff", width: 0, style: "solid", padding: 0 },
      borderRadius: 0,
      lighting: { ...lighting, intensity: 0 },
      filter: "none",
      portrait: { ...portrait, mode: "off" },
      pattern: { ...pattern, ids: [] },
      overlay: { ...overlay, opacity: 0 },
    },
    pose: {
      ...base,
      crop: { x: 20, y: 20, width: 60, height: 60 },
      padding: 120,
      canvasBorderRadius: 40,
      tilt: { rx: 20, ry: 10, rz: 5 },
      scale: 150,
      screenshotOffset: { x: 40, y: 30 },
      shadow: {
        type: "soft",
        intensity: 80,
        color: "#000000",
        lightSource: "center",
      },
      backdropEffects: { ...base.backdropEffects, brightness: 150, noise: 40 },
      border: { color: "#ff0000", width: 8, style: "solid", padding: 12 },
      borderRadius: 24,
      lighting: { ...lighting, intensity: 70 },
      filter: "vivid",
      portrait: { ...portrait, mode: "studio", intensity: 70 },
      pattern: { ...pattern, ids: [1] },
      overlay: { ...overlay, id: 3, opacity: 60 },
    },
    ...over,
  }
}

describe("release reaches every effect family", () => {
  let el: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("ends the release on exactly the frame the clip started from", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 0)
    const atStart = readVars(el)

    applyAt(el, clips, 1000)
    // Guard against a vacuous pass: the pose must actually differ from rest.
    expect(readVars(el)).not.toEqual(atStart)

    applyAt(el, clips, 2000)
    expect(readVars(el)).toEqual(atStart)

    applyAt(el, clips, 99000)
    expect(readVars(el)).toEqual(atStart)
  })

  it("mirrors the reveal — halfway out matches halfway in", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 500)
    const halfIn = readVars(el)

    applyAt(el, clips, 1500)
    expect(readVars(el)).toEqual(halfIn)
  })

  it("every animated var moves during the release, none of them stall", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 1000)
    const atPose = readVars(el)
    applyAt(el, clips, 1500)
    const midRelease = readVars(el)
    applyAt(el, clips, 2000)
    const atRest = readVars(el)

    const moved: string[] = []
    for (const name of VARS) {
      // A var reading the same at the pose and at rest was never animated by
      // this clip; every other one must have left the pose by mid-release.
      if (atPose[name] === atRest[name]) continue
      moved.push(name)
      expect([name, midRelease[name]]).not.toEqual([name, atPose[name]])
    }
    // Not a vacuous pass: one representative var per sampling path, so a
    // fixture that quietly stopped driving a family can't pass this file.
    expect(moved).toEqual(
      expect.arrayContaining([
        "--canvas-ts-scale", // generic keyframe sampler
        "--crop-view-box", // crop + its shell geometry
        "--editor-shadow-preview", // shadow's own layer sampler
        "--editor-border-outline-preview", // border
        "--bd-fx-preview", // backdrop effects
        "--bd-light-op-in", // lighting (inner side)
        backgroundLayerOpacityVar("c1"), // the five layer crossfades
        filterLayerOpacityVar("c1"),
        portraitLayerOpacityVar("c1"),
        patternLayerOpacityVar("c1"),
        overlayLayerOpacityVar("c1"),
      ])
    )
  })

  it("the shadow recedes on its own type instead of blinking off", () => {
    const clips = [everythingClip()]

    applyAt(el, clips, 1500)
    const mid = el.style.getPropertyValue("--editor-shadow-preview")
    expect(mid).not.toBe("none")
    expect(mid).not.toBe("")

    applyAt(el, clips, 2000)
    expect(el.style.getPropertyValue("--editor-shadow-preview")).toBe("none")
  })

  it("a clip that opts out holds instead of releasing", () => {
    const clips = [everythingClip({ returnToDefault: false })]

    applyAt(el, clips, 0)
    const atStart = readVars(el)

    // Nothing moves once the window is over, and it never comes back to rest.
    // (Compared past-the-end to past-the-end: the in-window frame writes the
    // border colour as rgba() while the hold path passes the pose hex through,
    // which is the same colour in a different notation.)
    applyAt(el, clips, 2000)
    const justAfter = readVars(el)
    expect(justAfter).not.toEqual(atStart)

    applyAt(el, clips, 99000)
    expect(readVars(el)).toEqual(justAfter)
  })
})

/**
 * Extra screenshot slots are a second, parallel set of sampling sites (their own
 * tilt/zoom/position/shadow/border/radius/padding/lighting frames). They were
 * patched alongside the main ones, so they get the same end-to-end check.
 */
describe("release reaches slot-scoped effects", () => {
  const SLOT_VARS = [
    "--slot-ts-scale",
    "--slot-ts-rx",
    "--slot-ts-rot",
    "--editor-shadow-preview",
    "--editor-border-outline-preview",
    "--editor-screenshot-radius",
  ]

  let el: HTMLElement
  let slotEl: HTMLElement
  let slotId: string

  beforeEach(() => {
    useEditorStore.getState().reset()
    slotId = useEditorStore.getState().addScreenshotSlot()!
    el = document.createElement("div")
    slotEl = document.createElement("div")
    slotEl.setAttribute("data-screenshot-slot-id", slotId)
    el.appendChild(slotEl)
    document.body.appendChild(el)
  })

  const slotClip = (over: Partial<AnimationClip> = {}): AnimationClip => {
    const base = captureClipPose(baseCanvas())
    const rest = {
      tilt: { rx: 0, ry: 0, rz: 0 },
      scale: 100,
      rotation: 0,
      shadow: {
        type: "none" as const,
        intensity: 0,
        color: "#000000",
        lightSource: "center",
      },
      border: {
        color: "#ffffff",
        width: 0,
        style: "solid" as const,
        padding: 0,
      },
      borderRadius: 0,
    }
    return {
      id: "c1",
      startMs: 0,
      durationMs: 1000,
      easing: "linear",
      target: { scope: "slot", slotId },
      effects: ["tilt", "zoom", "shadow", "border", "borderRadius"],
      baseline: { ...base, slots: { [slotId]: rest } },
      pose: {
        ...base,
        slots: {
          [slotId]: {
            tilt: { rx: 25, ry: 15, rz: 10 },
            scale: 160,
            rotation: 12,
            shadow: {
              type: "soft",
              intensity: 80,
              color: "#000000",
              lightSource: "center",
            },
            border: {
              color: "#ff0000",
              width: 6,
              style: "solid",
              padding: 10,
            },
            borderRadius: 20,
          },
        },
      },
      ...over,
    }
  }

  const readSlot = () =>
    Object.fromEntries(
      SLOT_VARS.map((v) => [v, slotEl.style.getPropertyValue(v)])
    )

  it("unwinds a slot's vars back to the frame it started from", () => {
    const clips = [slotClip()]

    applyAt(el, clips, 0)
    const atStart = readSlot()

    applyAt(el, clips, 1000)
    expect(readSlot()).not.toEqual(atStart)

    applyAt(el, clips, 2000)
    expect(readSlot()).toEqual(atStart)
    applyAt(el, clips, 99000)
    expect(readSlot()).toEqual(atStart)
  })

  it("mirrors the reveal on a slot too", () => {
    const clips = [slotClip()]

    applyAt(el, clips, 500)
    const halfIn = readSlot()

    applyAt(el, clips, 1500)
    expect(readSlot()).toEqual(halfIn)
  })
})
