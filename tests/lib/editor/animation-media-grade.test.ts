import { beforeEach, describe, expect, it } from "vitest"

import {
  mediaFilterBlendBetween,
  mediaFilterBlendCss,
  mediaFilterBlendOf,
} from "@/lib/editor/animation-playback"
import { applyAnimationFrameAtTime } from "@/lib/editor/apply-animation-frame"
import {
  assetFilterCss,
  MAIN_MEDIA_FX_PREVIEW_VAR,
  mediaFilterCss,
  NEUTRAL_MEDIA_ADJUSTMENTS,
  slotMediaFxPreviewVar,
} from "@/lib/editor/css-utils"
import { captureClipPose, useEditorStore } from "@/lib/editor/store"
import type {
  AnimationClip,
  AnimationEffect,
  CanvasState,
  MediaAdjustments,
} from "@/lib/editor/state-types"

const activeCanvas = (): CanvasState => {
  const s = useEditorStore.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}

const GRADED: MediaAdjustments = {
  ...NEUTRAL_MEDIA_ADJUSTMENTS,
  brightness: 140,
  saturation: 60,
}

/** A keyframe easing the media grade from the canvas's committed look to `to`. */
const gradeClip = (
  canvas: CanvasState,
  effects: AnimationEffect[],
  to: {
    mediaFilter?: CanvasState["mediaFilter"]
    mediaAdjustments?: MediaAdjustments
  }
): AnimationClip => {
  const base = captureClipPose(canvas)
  return {
    id: "c1",
    startMs: 0,
    durationMs: 1000,
    easing: "linear",
    effects,
    baseline: base,
    pose: { ...base, ...to },
  }
}

const applyAt = (
  el: HTMLElement,
  canvas: CanvasState,
  clips: AnimationClip[],
  timeMs: number
) =>
  applyAnimationFrameAtTime({
    canvasEl: el,
    canvas,
    globalAspect: { id: "auto", w: 16, h: 9 },
    clips,
    timeMs,
  })

const mainVar = (el: HTMLElement) =>
  el.style.getPropertyValue(MAIN_MEDIA_FX_PREVIEW_VAR)

describe("media filter blending", () => {
  it("keeps a preset's own chain while it is not blending", () => {
    const noir = mediaFilterBlendOf("noir")
    const vivid = mediaFilterBlendOf("vivid")
    expect(mediaFilterBlendCss(mediaFilterBlendBetween(noir, vivid, 0))).toBe(
      assetFilterCss("noir")
    )
    expect(mediaFilterBlendCss(mediaFilterBlendBetween(noir, vivid, 1))).toBe(
      assetFilterCss("vivid")
    )
    // Same preset on both ends is not a transition at all.
    expect(mediaFilterBlendCss(mediaFilterBlendBetween(noir, noir, 0.5))).toBe(
      assetFilterCss("noir")
    )
  })

  it("crosses between two presets channel by channel rather than snapping", () => {
    const mid = mediaFilterBlendBetween(
      mediaFilterBlendOf("none"),
      mediaFilterBlendOf("noir"),
      0.5
    )
    expect(mid.preset).toBeNull()
    // noir is grayscale(1) contrast(1.35) brightness(0.9) — halfway there.
    expect(mid.vector.grayscale).toBeCloseTo(0.5)
    expect(mid.vector.contrast).toBeCloseTo(1.175)
    expect(mid.vector.brightness).toBeCloseTo(0.95)
    expect(mediaFilterBlendCss(mid)).toBe(
      "grayscale(0.5) brightness(0.95) contrast(1.175)"
    )
  })

  it("blends out of a preset back to neutral", () => {
    const mid = mediaFilterBlendBetween(
      mediaFilterBlendOf("bw"),
      mediaFilterBlendOf("none"),
      0.5
    )
    expect(mid.vector.grayscale).toBeCloseTo(0.5)
    expect(mid.vector.contrast).toBeCloseTo(1.025)
  })
})

describe("media grade on the animate timeline", () => {
  let el: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("leaves the var alone when no keyframe animates the grade", () => {
    const canvas = activeCanvas()
    const clips = [gradeClip(canvas, ["tilt"], {})]
    applyAt(el, canvas, clips, 500)
    expect(mainVar(el)).toBe("")
  })

  it("settles on exactly the committed chain the keyframe's preset renders", () => {
    const canvas = activeCanvas()
    const clips = [gradeClip(canvas, ["mediaFilter"], { mediaFilter: "noir" })]

    applyAt(el, canvas, clips, 1000)
    expect(mainVar(el)).toBe(
      mediaFilterCss({
        enhance: canvas.enhance,
        filter: "noir",
        adjustments: NEUTRAL_MEDIA_ADJUSTMENTS,
      })
    )
  })

  it("reveals from the committed grade, not from neutral", () => {
    const canvas: CanvasState = { ...activeCanvas(), mediaFilter: "sepia" }
    const clips = [gradeClip(canvas, ["mediaFilter"], { mediaFilter: "noir" })]

    applyAt(el, canvas, clips, 0)
    expect(mainVar(el)).toContain(assetFilterCss("sepia"))

    applyAt(el, canvas, clips, 500)
    const mid = mainVar(el)
    expect(mid).not.toContain(assetFilterCss("sepia"))
    expect(mid).not.toContain(assetFilterCss("noir"))
  })

  it("carries the committed colour grade through a filter-only keyframe", () => {
    const canvas: CanvasState = {
      ...activeCanvas(),
      mediaAdjustments: GRADED,
    }
    const clips = [gradeClip(canvas, ["mediaFilter"], { mediaFilter: "noir" })]

    applyAt(el, canvas, clips, 1000)
    // The two halves share one var, so animating the preset must not silently
    // drop the grade the user committed.
    expect(mainVar(el)).toBe(
      mediaFilterCss({
        enhance: canvas.enhance,
        filter: "noir",
        adjustments: GRADED,
      })
    )
  })

  it("carries the committed filter preset through a grade-only keyframe", () => {
    const canvas: CanvasState = { ...activeCanvas(), mediaFilter: "vivid" }
    const clips = [
      gradeClip(canvas, ["mediaEffects"], { mediaAdjustments: GRADED }),
    ]

    applyAt(el, canvas, clips, 1000)
    expect(mainVar(el)).toBe(
      mediaFilterCss({
        enhance: canvas.enhance,
        filter: "vivid",
        adjustments: GRADED,
      })
    )
  })

  it("eases each colour-grade channel across the keyframe", () => {
    const canvas = activeCanvas()
    const clips = [
      gradeClip(canvas, ["mediaEffects"], { mediaAdjustments: GRADED }),
    ]

    applyAt(el, canvas, clips, 500)
    expect(mainVar(el)).toBe(
      mediaFilterCss({
        enhance: canvas.enhance,
        filter: "none",
        adjustments: {
          ...NEUTRAL_MEDIA_ADJUSTMENTS,
          brightness: 120,
          saturation: 80,
        },
      })
    )
  })

  it("holds the final grade past the end of a keyframe that does not release", () => {
    const canvas = activeCanvas()
    const clips = [
      {
        ...gradeClip(canvas, ["mediaFilter"], { mediaFilter: "noir" }),
        returnToDefault: false,
      },
    ]

    applyAt(el, canvas, clips, 1000)
    const atEnd = mainVar(el)
    applyAt(el, canvas, clips, 9000)
    expect(mainVar(el)).toBe(atEnd)
  })
})

describe("media grade on an extra screenshot slot", () => {
  let el: HTMLElement
  let slotEl: HTMLElement

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    slotEl = document.createElement("div")
    el.appendChild(slotEl)
    document.body.appendChild(el)
  })

  it("drives the slot's own grade var from a slot-targeted keyframe", () => {
    const slotId = useEditorStore.getState().addScreenshotSlot()!
    slotEl.dataset.screenshotSlotId = slotId
    const canvas = activeCanvas()
    const base = captureClipPose(canvas)
    const clips: AnimationClip[] = [
      {
        id: "c1",
        startMs: 0,
        durationMs: 1000,
        easing: "linear",
        target: { scope: "slot", slotId },
        effects: ["mediaFilter"],
        baseline: base,
        pose: {
          ...base,
          slots: {
            ...base.slots,
            [slotId]: { ...base.slots[slotId], filter: "noir" },
          },
        },
      },
    ]

    applyAt(el, canvas, clips, 1000)
    expect(slotEl.style.getPropertyValue(slotMediaFxPreviewVar(slotId))).toBe(
      mediaFilterCss({
        enhance: canvas.enhance,
        filter: "noir",
        adjustments: NEUTRAL_MEDIA_ADJUSTMENTS,
      })
    )
    // A slot keyframe must not repaint the main screenshot.
    expect(mainVar(el)).toBe("")
  })
})

/**
 * An unbound ("all") keyframe binds to the slot an edit targets, but only for
 * effects a slot can actually animate — `SLOT_ANIMATABLE_EFFECTS`. Leaving the
 * media grade out of that list would silently scope a per-slot grade to the
 * whole canvas.
 */
describe("a media-grade edit binds an unbound keyframe to the selected slot", () => {
  beforeEach(() => {
    useEditorStore.getState().reset()
  })

  const openUnboundClip = () => {
    const id = useEditorStore.getState().addAnimationClip()
    useEditorStore.getState().setIsAnimateMode(true)
    useEditorStore.getState().selectAnimationClip(id)
    return id
  }
  const clipById = (id: string) =>
    activeCanvas().animation!.clips.find((c) => c.id === id)!

  it("scopes a filter edit to the selected slot", () => {
    const slotId = useEditorStore.getState().addScreenshotSlot()!
    const clipId = openUnboundClip()
    expect(clipById(clipId).target ?? { scope: "all" }).toEqual({
      scope: "all",
    })

    useEditorStore.getState().setSelectedScreenshotSlotId(slotId)
    useEditorStore
      .getState()
      .applyScreenshotStyle({ slotId }, { filter: "noir" })

    expect(clipById(clipId).target).toEqual({ scope: "slot", slotId })
    expect(clipById(clipId).effects).toContain("mediaFilter")
  })

  it("scopes a colour-grade edit to the selected slot", () => {
    const slotId = useEditorStore.getState().addScreenshotSlot()!
    const clipId = openUnboundClip()

    useEditorStore.getState().setSelectedScreenshotSlotId(slotId)
    useEditorStore
      .getState()
      .applyScreenshotStyle({ slotId }, { adjustments: GRADED })

    expect(clipById(clipId).target).toEqual({ scope: "slot", slotId })
    expect(clipById(clipId).effects).toContain("mediaEffects")
  })

  it("leaves the keyframe canvas-wide when no slot is selected", () => {
    useEditorStore.getState().addScreenshotSlot()
    const clipId = openUnboundClip()

    useEditorStore.getState().applyScreenshotStyle("all", { filter: "noir" })

    expect(clipById(clipId).target ?? { scope: "all" }).toEqual({
      scope: "all",
    })
  })
})
