import { createRef } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AnnotationLayer } from "@/components/editor/canvas/annotation-layer"
import type { AnnotationStroke } from "@/lib/editor/store"

/**
 * `AnnotationLayer` — renders visible (non-eraser, non-hidden) strokes as SVG
 * paths, eraser strokes into masks, and an interactive capture layer.
 */
const stroke = (over: Partial<AnnotationStroke>): AnnotationStroke => ({
  id: "s1",
  mode: "pen",
  color: "#000",
  strokeWidth: 4,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  zIndex: 0,
  ...over,
})

function renderLayer(annotations: AnnotationStroke[], isAnnotating = false) {
  return render(
    <AnnotationLayer
      layerRef={createRef<SVGSVGElement>()}
      annotations={annotations}
      annotationMaskId="mask"
      isAnnotating={isAnnotating}
      cursorClass="cursor-crosshair"
      onPointerDown={() => {}}
      onPointerMove={() => {}}
      onPointerUp={() => {}}
      onClick={() => {}}
      onDoubleClick={() => {}}
    />
  )
}

describe("AnnotationLayer", () => {
  it("renders the interactive capture layer", () => {
    renderLayer([])
    expect(screen.getByLabelText("Annotation layer")).toBeInTheDocument()
  })

  it("renders one path per visible stroke", () => {
    const { container } = renderLayer([
      stroke({ id: "a" }),
      stroke({ id: "b" }),
    ])
    expect(
      container.querySelectorAll("[data-annotation-stroke-id]")
    ).toHaveLength(2)
  })

  it("excludes hidden and eraser strokes from the visible paths", () => {
    const { container } = renderLayer([
      stroke({ id: "a" }),
      stroke({ id: "hidden", hidden: true }),
      stroke({ id: "erase", mode: "eraser" }),
    ])
    const visible = container.querySelectorAll("[data-annotation-stroke-id]")
    expect(visible).toHaveLength(1)
    expect(visible[0]).toHaveAttribute("data-annotation-stroke-id", "a")
  })

  it("renders eraser strokes inside the mask", () => {
    const { container } = renderLayer([
      stroke({ id: "a" }),
      stroke({ id: "erase", mode: "eraser" }),
    ])
    expect(
      container.querySelectorAll("[data-annotation-eraser-id]").length
    ).toBeGreaterThan(0)
  })

  it("enables pointer events on the capture layer while annotating", () => {
    renderLayer([], true)
    const layer = screen.getByLabelText("Annotation layer")
    expect(layer).toHaveClass("pointer-events-auto", "cursor-crosshair")
  })

  it("disables pointer events on the capture layer when not annotating", () => {
    renderLayer([], false)
    expect(screen.getByLabelText("Annotation layer")).toHaveClass(
      "pointer-events-none"
    )
  })

  it("shows a sized eraser brush preview under the pointer", () => {
    const { container } = render(
      <AnnotationLayer
        layerRef={createRef<SVGSVGElement>()}
        annotations={[]}
        annotationMaskId="mask"
        isAnnotating
        cursorClass="cursor-none"
        eraserBrushSize={11}
        onPointerDown={() => {}}
        onPointerMove={() => {}}
        onPointerUp={() => {}}
        onClick={() => {}}
        onDoubleClick={() => {}}
      />
    )
    const layer = screen.getByLabelText("Annotation layer")
    Object.defineProperty(layer, "clientWidth", {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(layer, "clientHeight", {
      configurable: true,
      value: 100,
    })
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    })
    fireEvent.pointerMove(layer, { clientX: 40, clientY: 60 })
    const brush = container.querySelector(
      "[data-annotation-eraser-brush='true']"
    )
    expect(brush).toBeTruthy()
    expect(brush).toHaveStyle({ width: "11px", height: "11px" })
  })
})
