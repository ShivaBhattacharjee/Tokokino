import type * as React from "react"
import { act, renderHook } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { usePlacementMeasurement } from "@/components/editor/canvas/use-placement-measurement"

/**
 * Contain shells are sized FROM the dims this hook reports, so a measurement
 * that outlives its layout pins the box: the shell can no longer resize, the
 * ResizeObserver never fires, and nothing re-measures. That's how a video
 * dropped onto a previously-cropped image rendered inside the image's box until
 * a reload. The hook must therefore drop its measurement as soon as `layoutKey`
 * changes, not merely re-run the measure.
 */
beforeAll(() => {
  if (typeof ResizeObserver === "undefined") {
    // jsdom has no ResizeObserver; the hook only needs it to construct.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

/** A node reporting a fixed box, mimicking a laid-out stage/shell. */
function boxRef(w: number, h: number) {
  const el = document.createElement("div")
  Object.defineProperty(el, "offsetWidth", { value: w, configurable: true })
  Object.defineProperty(el, "offsetHeight", { value: h, configurable: true })
  Object.defineProperty(el, "clientWidth", { value: w, configurable: true })
  Object.defineProperty(el, "clientHeight", { value: h, configurable: true })
  document.body.appendChild(el)
  return { current: el }
}

const setup = (layoutKey: string, enabled = true) => {
  const stageRef = boxRef(800, 600) as React.RefObject<HTMLDivElement | null>
  const imageRef = boxRef(
    400,
    300
  ) as unknown as React.RefObject<HTMLImageElement | null>
  return renderHook(
    ({ key }: { key: string }) =>
      usePlacementMeasurement({
        enabled,
        stageRef,
        imageRef,
        layoutKey: key,
      }),
    { initialProps: { key: layoutKey } }
  )
}

describe("usePlacementMeasurement", () => {
  it("measures the stage and image boxes", () => {
    const { result } = setup("a")
    act(() => result.current.measurePlacement())
    expect(result.current.placementDims).toMatchObject({
      stageW: 800,
      stageH: 600,
      imgW: 400,
      imgH: 300,
    })
  })

  it("drops the measurement when the layout key changes", () => {
    // `enabled: false` keeps the layout effect from immediately re-measuring,
    // isolating the render-phase reset. In the app that re-measure is the point:
    // the shell unpins first, THEN gets measured at its real new size.
    const { result, rerender } = setup("a", false)
    act(() => result.current.measurePlacement())
    expect(result.current.placementDims).not.toBeNull()

    rerender({ key: "b" })

    // The stale box must NOT survive into the new layout — a contain shell
    // sized from it would pin itself and never resize again.
    expect(result.current.placementDims).toBeNull()
  })

  it("re-measures under the new key", () => {
    const { result, rerender } = setup("a")
    act(() => result.current.measurePlacement())
    rerender({ key: "b" })
    act(() => result.current.measurePlacement())

    expect(result.current.placementDims).toMatchObject({
      stageW: 800,
      imgW: 400,
    })
  })

  it("keeps the same object identity when nothing changed", () => {
    const { result } = setup("a")
    act(() => result.current.measurePlacement())
    const first = result.current.placementDims
    act(() => result.current.measurePlacement())

    // Re-measuring an unchanged layout must not churn the reference — callers
    // use it as a memo/effect dependency.
    expect(result.current.placementDims).toBe(first)
  })
})
