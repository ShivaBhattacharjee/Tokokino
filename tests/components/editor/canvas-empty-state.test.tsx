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

vi.mock("@/components/editor/canvas/helpers", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    frameFitStyle: () => ({}),
    framePositionTransform: () => "translate(-50%, -50%)",
  }
})

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

  it("prefers bare free placement over frame-style anchor positioning", () => {
    const { container } = render(
      <CanvasEmptyState
        isDragOver={false}
        onBrowse={() => {}}
        screenshotAnchor={{ x: 100, y: 100 }}
        freePlacement={{ left: 12, top: 34, width: 200, height: 120 }}
        transform="perspective(1400px) scale(1.16)"
      />
    )
    const positioned = container.querySelector(
      "[data-editor-shadow-filter-target]"
    ) as HTMLElement
    expect(positioned).not.toBeNull()
    // Free placement uses pixel left/top (via live-preview vars) — not the
    // frame translate(-50%, -50%) centering used by device mockups.
    expect(positioned.style.left).toContain("12px")
    expect(positioned.style.top).toContain("34px")
    expect(positioned.style.width).toBe("200px")
    expect(positioned.style.height).toBe("120px")
    expect(positioned.style.transform).toBe("perspective(1400px) scale(1.16)")
  })
})
