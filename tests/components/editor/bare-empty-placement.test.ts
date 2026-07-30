import { describe, expect, it } from "vitest"

import { bareEmptyPlacement } from "@/components/editor/canvas/helpers"

const CANVAS_W = 1100
const CANVAS_H = 687.5
const ASPECT = CANVAS_W / CANVAS_H

/** Content box the browser lays out for `padding: n` on a 1100px-wide canvas. */
function stageFor(padding: number) {
  const pad = (padding / 1200) * CANVAS_W
  return { w: CANVAS_W - 2 * pad, h: CANVAS_H - 2 * pad }
}

const base = {
  aspectRatio: ASPECT,
  objectFit: undefined,
  scaleFactor: 1,
  positionX: 0.5,
  positionY: 0.5,
} as const

describe("bareEmptyPlacement", () => {
  it("fills the stage exactly when cover-fitted and centered", () => {
    const stage = stageFor(40)
    const box = bareEmptyPlacement({ ...base, stage })

    expect(box.left).toBeCloseTo(0)
    expect(box.top).toBeCloseTo(0)
    expect(box.width).toBeCloseTo(stage.w)
    expect(box.height).toBeCloseTo(stage.h)
  })

  /**
   * The regression: padding previews through a CSS var during a slider drag, so
   * the box must be sized from the stage the browser laid out. Sizing it from
   * the still-committed padding put a full-canvas box at the padded origin,
   * overflowing the canvas right and bottom until the drag was released.
   */
  it("tracks the previewed stage rather than the committed padding", () => {
    const committed = 0
    const previewed = 140

    const drifted = bareEmptyPlacement({ ...base, stage: stageFor(committed) })
    const tracked = bareEmptyPlacement({ ...base, stage: stageFor(previewed) })

    const padPx = (previewed / 1200) * CANVAS_W
    // What the drifted box did: full-canvas size sitting at the padded origin.
    expect(padPx + drifted.width).toBeGreaterThan(CANVAS_W)
    expect(padPx + drifted.height).toBeGreaterThan(CANVAS_H)
    // What it must do: stay inside the canvas, inset by the previewed padding.
    expect(padPx + tracked.width).toBeCloseTo(CANVAS_W - padPx)
    expect(padPx + tracked.height).toBeCloseTo(CANVAS_H - padPx)
  })

  it("shrink-wraps to the canvas aspect when contain-fitted", () => {
    const stage = { w: 1000, h: 400 }
    const box = bareEmptyPlacement({ ...base, stage, objectFit: "contain" })

    expect(box.width).toBeCloseTo(400 * ASPECT)
    expect(box.height).toBeCloseTo(400)
    // Letterboxed horizontally, so it is inset from the stage's left edge.
    expect(box.left).toBeCloseTo((stage.w - box.width) / 2)
    expect(box.top).toBeCloseTo(0)
  })

  it("treats an unset objectFit as cover, matching the uploaded screenshot", () => {
    const stage = { w: 1000, h: 400 }
    const unset = bareEmptyPlacement({ ...base, stage })
    const cover = bareEmptyPlacement({ ...base, stage, objectFit: "cover" })

    expect(unset).toEqual(cover)
  })

  it("moves the box toward the anchor without resizing it", () => {
    const stage = stageFor(40)
    const centered = bareEmptyPlacement({ ...base, stage })
    const topLeft = bareEmptyPlacement({
      ...base,
      stage,
      positionX: 0,
      positionY: 0,
    })

    expect(topLeft.width).toBeCloseTo(centered.width)
    expect(topLeft.height).toBeCloseTo(centered.height)
    expect(topLeft.left).toBeLessThan(centered.left)
    expect(topLeft.top).toBeLessThan(centered.top)
  })

  it("never divides by a collapsed stage", () => {
    const box = bareEmptyPlacement({ ...base, stage: { w: 0, h: 0 } })

    expect(Number.isFinite(box.left)).toBe(true)
    expect(Number.isFinite(box.top)).toBe(true)
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})
