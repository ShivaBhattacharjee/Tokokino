import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import ScreenshotsLayout from "@/app/app/layout"

describe("app/app/layout", () => {
  it("renders the children it is given", () => {
    render(
      <ScreenshotsLayout>
        <span data-testid="child">hello</span>
      </ScreenshotsLayout>
    )

    expect(screen.getByTestId("child")).toHaveTextContent("hello")
  })

  it("wraps children in a full-height, overflow-hidden themed shell", () => {
    const { container } = render(
      <ScreenshotsLayout>
        <span>child</span>
      </ScreenshotsLayout>
    )

    const shell = container.firstElementChild as HTMLElement
    expect(shell.tagName).toBe("DIV")
    expect(shell).toHaveClass(
      "h-svh",
      "overflow-hidden",
      "bg-background",
      "text-foreground"
    )
  })

  it("renders multiple children in order", () => {
    render(
      <ScreenshotsLayout>
        <span data-testid="a">a</span>
        <span data-testid="b">b</span>
      </ScreenshotsLayout>
    )

    const shell = screen.getByTestId("a").parentElement as HTMLElement
    // The shell also renders the resource-timing script, so compare only the
    // children it was handed.
    const rendered = [...shell.children].filter(
      (child) => child.tagName !== "SCRIPT"
    )
    expect(rendered).toHaveLength(2)
    expect(rendered[0]).toHaveAttribute("data-testid", "a")
    expect(rendered[1]).toHaveAttribute("data-testid", "b")
  })

  it("raises the resource-timing buffer before the page scripts load", () => {
    const { container } = render(
      <ScreenshotsLayout>
        <span>child</span>
      </ScreenshotsLayout>
    )

    // Offline shell capture reads performance.getEntriesByType("resource") to
    // find lazily loaded chunks; the default 250-entry buffer would drop them.
    const script = container.querySelector("script")
    expect(script?.innerHTML).toContain("setResourceTimingBufferSize")
    expect(container.firstElementChild?.firstElementChild).toBe(script)
  })
})
