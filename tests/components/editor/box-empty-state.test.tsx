import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `BoxEmptyState` — empty drop target for a screenshot box. Renders a static
 * plus glyph in `presentational` mode, otherwise an interactive `UploadCard`.
 * The UploadCard is stubbed to surface the props the box forwards.
 */
vi.mock("@/components/editor/canvas/upload-card", () => ({
  UploadCard: (props: { isDragOver?: boolean; compact?: boolean }) => (
    <div
      data-testid="upload-card"
      data-drag-over={String(Boolean(props.isDragOver))}
      data-compact={String(Boolean(props.compact))}
    />
  ),
}))

import { BoxEmptyState } from "@/components/editor/canvas/box-empty-state"

describe("BoxEmptyState", () => {
  it("renders a static glyph with no upload card in presentational mode", () => {
    const { container } = render(
      <BoxEmptyState presentational onBrowse={() => {}} />
    )
    expect(screen.queryByTestId("upload-card")).not.toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders an interactive upload card by default", () => {
    render(<BoxEmptyState onBrowse={() => {}} />)
    expect(screen.getAllByTestId("upload-card").length).toBeGreaterThan(0)
  })

  it("renders a single compact upload card when compact", () => {
    render(<BoxEmptyState compact onBrowse={() => {}} />)
    const cards = screen.getAllByTestId("upload-card")
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveAttribute("data-compact", "true")
  })

  it("reflects the drag-over state on the backdrop", () => {
    const { container } = render(
      <BoxEmptyState isDragOver onBrowse={() => {}} compact />
    )
    expect(container.querySelector('[data-drag-over="true"]')).not.toBeNull()
  })
})
