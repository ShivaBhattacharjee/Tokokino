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

  it("releases the crop back to the baseline rect after the clip", () => {
    const clips = [cropClip()]

    applyAt(el, clips, 1000)
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(20% 20% 20% 20%)")

    // The release mirrors the reveal, so halfway back out reads like halfway in.
    applyAt(el, clips, 1500)
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(10% 10% 10% 10%)")

    applyAt(el, clips, 9999)
    expect(el.style.getPropertyValue(VIEW_BOX)).toBe("inset(0% 0% 0% 0%)")
  })

  it("holds the last crop past the end when the clip opts out", () => {
    const clips = [cropClip({ returnToDefault: false })]
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

/**
 * Fill-mode correction for an animated crop. The polyfill maps the crop window
 * onto the shell with fill semantics, so contain/cover are corrected per frame
 * from a live measurement — which means the measurement has to survive the
 * export clone, where the `<video>` is swapped for an `<img>` stand-in.
 */
describe("animated crop → fill-mode correction", () => {
  let el: HTMLElement

  const mountShell = (media: HTMLElement, naturalW = 1920, naturalH = 1080) => {
    const stage = document.createElement("div")
    stage.style.width = "800px"
    stage.style.height = "450px"
    const shell = document.createElement("div")
    shell.setAttribute("data-export-stack", "media")
    Object.defineProperty(media, "videoWidth", { value: naturalW })
    Object.defineProperty(media, "videoHeight", { value: naturalH })
    Object.defineProperty(media, "naturalWidth", { value: naturalW })
    Object.defineProperty(media, "naturalHeight", { value: naturalH })
    shell.appendChild(media)
    stage.appendChild(shell)
    el.appendChild(stage)
  }

  beforeEach(() => {
    useEditorStore.getState().reset()
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  it("corrects the fit against a live <video>", () => {
    mountShell(document.createElement("video"))
    applyAt(el, [cropClip()], 1000)

    expect(el.style.getPropertyValue("--crop-fit-origin")).not.toBe("")
    expect(el.style.getPropertyValue("--crop-shell-w")).toBe("800px")
  })

  it("corrects the fit from seeded dims before the stand-in's first paint", () => {
    // Frame 0 applies before any paint, so naturalWidth is still 0 — the swap
    // seeds the source video's dims so the correction is not skipped.
    const img = document.createElement("img")
    const stage = document.createElement("div")
    stage.style.width = "800px"
    stage.style.height = "450px"
    const shell = document.createElement("div")
    shell.setAttribute("data-export-stack", "media")
    img.dataset.naturalW = "1920"
    img.dataset.naturalH = "1080"
    shell.appendChild(img)
    stage.appendChild(shell)
    el.appendChild(stage)

    applyAt(el, [cropClip()], 1000)
    expect(el.style.getPropertyValue("--crop-shell-w")).toBe("800px")
  })

  it("corrects the fit against the export clone's <img> stand-in", () => {
    // Regression: matching only `video` found nothing in the clone, so every
    // exported frame lost the correction and the crop landed unfitted.
    mountShell(document.createElement("img"))
    applyAt(el, [cropClip()], 1000)

    expect(el.style.getPropertyValue("--crop-fit-origin")).not.toBe("")
    expect(el.style.getPropertyValue("--crop-shell-w")).toBe("800px")
  })
})

/**
 * A contain crop resizes the shell, and the bare placement centres the main
 * screenshot on that size. Both are decided in the same pass, so the placement
 * must use the size the crop IMPLIES, not one read back from the DOM — a
 * measurement can only report the previous frame's box, which centres the card
 * on a stale width and makes the crop appear to come in from one edge only.
 */
describe("animated crop \u2192 placement stays centred", () => {
  let el: HTMLElement

  const STAGE_W = 800
  const STAGE_H = 450
  // Trimmed left and right only: 60% of a 1920x1080 source is 1152x1080, so the
  // contain box in an 800x450 stage is height-limited at 480x450.
  const SIDE_CROP = { x: 20, y: 0, width: 60, height: 100 }
  const EXPECTED_SHELL_W = 480

  const mount = () => {
    const stage = document.createElement("div")
    stage.style.width = `${STAGE_W}px`
    stage.style.height = `${STAGE_H}px`
    const shell = document.createElement("div")
    shell.setAttribute("data-export-stack", "media")
    shell.setAttribute("data-editor-shadow-box-target", "")
    // The DOM still reports the pre-crop width, as it does mid-animation.
    Object.defineProperty(shell, "offsetWidth", { value: STAGE_W })
    Object.defineProperty(shell, "offsetHeight", { value: STAGE_H })
    const img = document.createElement("img")
    img.dataset.naturalW = "1920"
    img.dataset.naturalH = "1080"
    shell.appendChild(img)
    stage.appendChild(shell)
    el.appendChild(stage)
  }

  beforeEach(() => {
    useEditorStore.getState().reset()
    // The bare-pixel placement only runs for a free-floating main screenshot.
    useEditorStore
      .getState()
      .setScreenshot("data:image/png;base64,iVBORw0KGgo=")
    el = document.createElement("div")
    document.body.appendChild(el)
  })

  const sideCropClip = (effects: string[]) => {
    const pose = captureClipPose(baseCanvas())
    return {
      id: "clip-side-crop",
      startMs: 0,
      durationMs: 1000,
      effects,
      easing: "linear",
      baseline: { ...pose, crop: FULL_CROP_REGION },
      pose: { ...pose, crop: SIDE_CROP },
    } as AnimationClip
  }

  it("re-centres a crop-only clip, which never touches position", () => {
    // The committed `left` is a px value React baked from the uncropped box.
    // An export clone is static and cannot recompute it, so unless the crop
    // drives the placement the shell shrinks about a frozen left edge.
    mount()
    applyAt(el, [sideCropClip(["crop"])], 1000)

    expect(el.style.getPropertyValue("--crop-shell-w")).toBe(
      `${EXPECTED_SHELL_W}px`
    )
    const left = parseFloat(
      el.style.getPropertyValue("--editor-main-bare-left")
    )
    expect(left).not.toBeNaN()
    expect(left).toBeCloseTo((STAGE_W - EXPECTED_SHELL_W) / 2, 0)
  })

  it("centres on the crop's shell box, not the stale measured width", () => {
    mount()
    const canvas = baseCanvas()
    const pose = captureClipPose(canvas)
    applyAt(
      el,
      [
        {
          id: "clip-side-crop",
          startMs: 0,
          durationMs: 1000,
          effects: ["crop", "position"],
          easing: "linear",
          baseline: { ...pose, crop: FULL_CROP_REGION },
          pose: { ...pose, crop: SIDE_CROP },
        },
      ],
      1000
    )

    // The crop narrowed the shell...
    expect(el.style.getPropertyValue("--crop-shell-w")).toBe(
      `${EXPECTED_SHELL_W}px`
    )
    // ...and the placement centred on THAT width, not the 800px still in the DOM.
    const left = parseFloat(
      el.style.getPropertyValue("--editor-main-bare-left")
    )
    expect(left).not.toBeNaN()
    expect(left).toBeCloseTo((STAGE_W - EXPECTED_SHELL_W) / 2, 0)
  })
})
