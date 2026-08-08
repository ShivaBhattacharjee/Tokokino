import { beforeEach, describe, expect, it } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import type { Background, Shadow } from "@/lib/editor/state-types"

const store = useEditorStore
const activeCanvas = () => {
  const s = store.getState().present
  return s.canvases.find((c) => c.id === s.activeCanvasId)!
}
const clipsOf = () => activeCanvas().animation!.clips

const RED: Background = { type: "solid", value: "#ff0000" }
const GLOW: Shadow = {
  type: "glow",
  intensity: 80,
  lightSource: "center",
  color: "#00ff00",
}

/** Open a fresh keyframe for editing and return its id. */
const openClip = () => {
  store.getState().addAnimationClip()
  store.getState().setIsAnimateMode(true)
  const id = clipsOf()[0].id
  store.getState().selectAnimationClip(id)
  return id
}

/**
 * A keyframe describes motion; it must not leave its look baked into the
 * document. Exiting Animate mode restores the canvas to where the animation
 * STARTS for every effect — not just position, which always behaved this way.
 */
describe("animation resting frame", () => {
  beforeEach(() => store.getState().reset())

  it("does not bind an animated background to the committed canvas", () => {
    const before = activeCanvas().background
    openClip()
    store.getState().setBackground(RED)
    expect(clipsOf()[0].effects).toContain("background")

    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().background).toEqual(before)
    expect(clipsOf()[0].pose?.background).toEqual(RED)
  })

  it("does not bind an animated shadow to the committed canvas", () => {
    const before = activeCanvas().shadow
    openClip()
    store.getState().setShadow(GLOW)

    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().shadow).toEqual(before)
    expect(clipsOf()[0].pose?.shadow).toEqual(GLOW)
  })

  it("does not bind an animated media grade to the committed canvas", () => {
    openClip()
    store.getState().applyScreenshotStyle("main", { filter: "noir" })
    expect(clipsOf()[0].effects).toContain("mediaFilter")

    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().mediaFilter ?? "none").toBe("none")
    expect(clipsOf()[0].pose?.mediaFilter).toBe("noir")
  })

  it("survives an animate-mode round trip without flattening the keyframe", () => {
    const before = activeCanvas().background
    openClip()
    store.getState().setBackground(RED)
    store.getState().setIsAnimateMode(false)

    store.getState().setIsAnimateMode(true)
    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().background).toEqual(before)
    expect(clipsOf()[0].pose?.background).toEqual(RED)
    expect(clipsOf()[0].baseline?.background).toEqual(before)
  })

  it("routes an edit made outside animate mode to where the animation starts", () => {
    openClip()
    store.getState().setBackground(RED)
    store.getState().setIsAnimateMode(false)

    // Outside Animate mode the canvas shows the start, so restyling it must move
    // the animation's origin — not overwrite the keyframe it travels to.
    const blue: Background = { type: "solid", value: "#0000ff" }
    store.getState().setBackground(blue)
    store.getState().setIsAnimateMode(true)
    store.getState().setIsAnimateMode(false)

    expect(clipsOf()[0].baseline?.background).toEqual(blue)
    expect(clipsOf()[0].pose?.background).toEqual(RED)
    expect(activeCanvas().background).toEqual(blue)
  })

  it("still carries an outside edit to a property no keyframe animates", () => {
    openClip()
    store.getState().setBackground(RED)
    store.getState().setIsAnimateMode(false)

    // Nothing animates the shadow, so it is plain document style and must stick.
    store.getState().setShadow(GLOW)
    store.getState().setIsAnimateMode(true)
    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().shadow).toEqual(GLOW)
    expect(clipsOf()[0].pose?.shadow).toEqual(GLOW)
  })

  it("leaves the canvas alone entirely when the timeline is empty", () => {
    const before = activeCanvas()
    store.getState().setIsAnimateMode(true)
    store.getState().setIsAnimateMode(false)

    expect(activeCanvas().background).toEqual(before.background)
    expect(activeCanvas().shadow).toEqual(before.shadow)
  })

  it("rests at the FIRST keyframe's baseline across several keyframes", () => {
    const before = activeCanvas().background
    const first = openClip()
    store.getState().setBackground(RED)

    const second = store.getState().addAnimationClip()
    store.getState().selectAnimationClip(second)
    const green: Background = { type: "solid", value: "#00ff00" }
    store.getState().setBackground(green)

    store.getState().setIsAnimateMode(false)

    const clips = clipsOf()
    expect(clips.find((c) => c.id === first)?.pose?.background).toEqual(RED)
    expect(clips.find((c) => c.id === second)?.pose?.background).toEqual(green)
    // The canvas holds what the FIRST keyframe eases from — the pre-animation
    // look — rather than either keyframe's.
    expect(activeCanvas().background).toEqual(before)
  })
})
