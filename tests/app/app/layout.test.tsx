import { readFileSync } from "node:fs"
import { join } from "node:path"

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
    expect(shell.children).toHaveLength(2)
    expect(shell.children[0]).toHaveAttribute("data-testid", "a")
    expect(shell.children[1]).toHaveAttribute("data-testid", "b")
  })

  it("renders no script of its own", () => {
    // React never executes a script it creates during a client render, so a
    // route layout — re-created on every client navigation into /app — is the
    // one place this app's inline setup script must not live. It belongs in the
    // root layout's <head> (asserted below).
    const { container } = render(
      <ScreenshotsLayout>
        <span>child</span>
      </ScreenshotsLayout>
    )

    expect(container.querySelector("script")).toBeNull()
  })
})

describe("app/layout (root)", () => {
  // The root layout pulls next/font, global CSS and every provider, so it is
  // read rather than rendered: what matters is only where the tag sits.
  const source = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8")

  it("raises the resource-timing buffer from a script in <head>", () => {
    const headStart = source.indexOf("<head>")
    const headEnd = source.indexOf("</head>")
    expect(headStart).toBeGreaterThan(-1)
    expect(headEnd).toBeGreaterThan(headStart)
    const head = source.slice(headStart, headEnd)

    // Offline shell capture reads performance.getEntriesByType("resource") to
    // find lazily loaded chunks; the default 250-entry buffer would drop them.
    // Pin the whole payload, not a mention of the API: a raised buffer that
    // isn't inside an executed <script>, or is raised to some smaller number,
    // loses the same chunks it was added to keep.
    expect(head).toMatch(
      /<script\b[^>]*?__html:\s*"performance\.setResourceTimingBufferSize\?\.\(1000\)"[^>]*?\/>/
    )
  })
})
