import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EmptyStateBackdrop } from "@/components/editor/canvas/empty-state-backdrop"

/**
 * `EmptyStateBackdrop` — forwardRef wrapper div with a decorative grid. Passes
 * through className, children, ref and arbitrary div attributes.
 */
describe("EmptyStateBackdrop", () => {
  it("renders children", () => {
    render(
      <EmptyStateBackdrop>
        <span data-testid="child">hi</span>
      </EmptyStateBackdrop>
    )
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })

  it("merges className with the base classes", () => {
    const { container } = render(<EmptyStateBackdrop className="my-bg" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveClass("my-bg", "relative", "size-full")
  })

  it("forwards the ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>()
    render(<EmptyStateBackdrop ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it("spreads arbitrary div props", () => {
    const { container } = render(
      <EmptyStateBackdrop data-foo="bar" role="presentation" />
    )
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute("data-foo", "bar")
    expect(el).toHaveAttribute("role", "presentation")
  })
})
