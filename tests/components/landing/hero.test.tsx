import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * The hero's entrance runs on the `landing-rise` CSS class rather than
 * motion's inline styles, so the server-rendered H1 and copy are readable by
 * crawlers and agents that never execute JS. These tests pin that down.
 */
vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(tag, props, children as React.ReactNode),
      }
    ),
    useMotionValue: () => 0,
    useTransform: () => 0,
    animate: () => ({ stop: () => {} }),
  }
})

vi.mock("@/components/landing/mockup-frame", () => ({
  MockupFrame: () => null,
}))

const { Hero } = await import("@/components/landing/hero")

describe("Hero", () => {
  it("renders the H1 without an opacity or transform inline style", () => {
    render(<Hero />)

    const heading = screen.getByRole("heading", { level: 1 })
    const style = heading.getAttribute("style") ?? ""

    expect(style).not.toMatch(/opacity/)
    expect(style).not.toMatch(/transform/)
  })

  it("drives the H1 entrance from the landing-rise class", () => {
    render(<Hero />)

    const heading = screen.getByRole("heading", { level: 1 })

    expect(heading.className).toContain("landing-rise")
    expect(heading.getAttribute("style")).toContain("--landing-rise-delay")
  })

  it("keeps the headline text in the markup", () => {
    render(<Hero />)

    const heading = screen.getByRole("heading", { level: 1 })

    expect(heading.textContent).toContain("Make every product visual")
    expect(heading.textContent).toContain("intentional")
  })
})
