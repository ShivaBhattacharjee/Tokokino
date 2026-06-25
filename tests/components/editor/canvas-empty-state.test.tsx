import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `CanvasEmptyState` — the empty drop target wrapper. It positions a
 * `BoxEmptyState` either with normal flow or absolutely (when a
 * `screenshotAnchor` is given). Children + helpers are stubbed.
 */
vi.mock("@/lib/editor/store", () => ({
  useEditor: () => ({ aspect: { id: "16-10", w: 16, h: 10 } }),
}))

vi.mock("@/components/editor/canvas/box-empty-state", () => ({
  BoxEmptyState: (props: { isDragOver?: boolean; compact?: boolean }) => (
    <div
      data-testid="box-empty-state"
      data-drag-over={String(Boolean(props.isDragOver))}
      data-compact={String(Boolean(props.compact))}
    />
  ),
}))

vi.mock("@/components/editor/canvas/helpers", () => ({
  frameFitStyle: () => ({}),
  framePositionTransform: () => "translate(-50%, -50%)",
}))

import { CanvasEmptyState } from "@/components/editor/canvas/canvas-empty-state"

describe("CanvasEmptyState", () => {
  it("renders a BoxEmptyState in the default (flow) layout", () => {
    render(<CanvasEmptyState isDragOver={false} onBrowse={() => {}} />)
    expect(screen.getByTestId("box-empty-state")).toBeInTheDocument()
  })

  it("reflects drag-over and active state on the wrapper", () => {
    const { container } = render(
      <CanvasEmptyState isDragOver onBrowse={() => {}} isActive />
    )
    expect(
      container.querySelector('[data-drag-over="true"][data-active="true"]')
    ).not.toBeNull()
  })

  it("forwards isDragOver to the inner box", () => {
    render(<CanvasEmptyState isDragOver onBrowse={() => {}} />)
    expect(screen.getByTestId("box-empty-state")).toHaveAttribute(
      "data-drag-over",
      "true"
    )
  })

  it("uses absolute positioning when a screenshot anchor is provided", () => {
    const { container } = render(
      <CanvasEmptyState
        isDragOver={false}
        onBrowse={() => {}}
        screenshotAnchor={{ x: 1, y: 0 }}
      />
    )
    // The positioned branch applies a transform from framePositionTransform.
    const positioned = container.querySelector(
      "[data-editor-shadow-filter-target]"
    ) as HTMLElement
    expect(positioned).not.toBeNull()
    expect(positioned.style.transform).toContain("translate(-50%, -50%)")
  })
})
