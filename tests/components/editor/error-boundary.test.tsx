import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EditorErrorBoundary } from "@/components/editor/error-boundary"

/**
 * `EditorErrorBoundary` — class error boundary. Props: children, label,
 * className, resetKeys. Renders a fallback ("<label> crashed" + Retry) when a
 * child throws, recovers via Retry or when `resetKeys` change.
 */

// A child that throws while the module-level flag is set.
let shouldThrow = true
function Bomb() {
  if (shouldThrow) throw new Error("boom")
  return <div data-testid="safe">safe</div>
}

beforeEach(() => {
  shouldThrow = true
  // React logs caught render errors to console.error — silence the noise.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("EditorErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    shouldThrow = false
    render(
      <EditorErrorBoundary>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByTestId("safe")).toBeInTheDocument()
    expect(screen.queryByText(/crashed/)).not.toBeInTheDocument()
  })

  it("renders the fallback with a default label when a child throws", () => {
    render(
      <EditorErrorBoundary>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByText("Editor surface crashed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument()
  })

  it("uses the provided label in the fallback", () => {
    render(
      <EditorErrorBoundary label="Canvas">
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByText("Canvas crashed")).toBeInTheDocument()
  })

  it("applies className to the fallback container", () => {
    const { container } = render(
      <EditorErrorBoundary className="my-fallback">
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(container.querySelector(".my-fallback")).not.toBeNull()
  })

  it("recovers via the Retry button once the child stops throwing", async () => {
    const user = userEvent.setup()
    render(
      <EditorErrorBoundary>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByText("Editor surface crashed")).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByRole("button", { name: /Retry/ }))

    expect(screen.getByTestId("safe")).toBeInTheDocument()
    expect(screen.queryByText(/crashed/)).not.toBeInTheDocument()
  })

  it("resets when resetKeys change", () => {
    const { rerender } = render(
      <EditorErrorBoundary resetKeys={[1]}>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByText("Editor surface crashed")).toBeInTheDocument()

    shouldThrow = false
    rerender(
      <EditorErrorBoundary resetKeys={[2]}>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByTestId("safe")).toBeInTheDocument()
  })

  it("stays in the fallback when resetKeys are unchanged", () => {
    const { rerender } = render(
      <EditorErrorBoundary resetKeys={[1]}>
        <Bomb />
      </EditorErrorBoundary>
    )
    expect(screen.getByText("Editor surface crashed")).toBeInTheDocument()

    shouldThrow = false
    rerender(
      <EditorErrorBoundary resetKeys={[1]}>
        <Bomb />
      </EditorErrorBoundary>
    )
    // resetKeys didn't change → boundary keeps showing the fallback.
    expect(screen.getByText("Editor surface crashed")).toBeInTheDocument()
  })
})
