import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// motion's scroll hooks need a real layout; stub them so the component renders
// deterministically in jsdom.
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
    useScroll: () => ({ scrollYProgress: 0 }),
    useTransform: () => 0,
  }
})

import {
  ScrollFadeBody,
  hiddenScrollbarClass,
} from "@/components/editor/scroll-fade"

/**
 * `ScrollFadeBody` — scroll container with top/bottom fade gradients. Props:
 * children, id, className, rootClassName, fadeClassName.
 */
describe("ScrollFadeBody", () => {
  it("renders its children", () => {
    render(
      <ScrollFadeBody>
        <p data-testid="content">scroll me</p>
      </ScrollFadeBody>
    )
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("puts the id on the scroll container", () => {
    render(
      <ScrollFadeBody id="my-scroll">
        <p>x</p>
      </ScrollFadeBody>
    )
    expect(document.getElementById("my-scroll")).not.toBeNull()
  })

  it("applies rootClassName, className and fadeClassName", () => {
    const { container } = render(
      <ScrollFadeBody
        rootClassName="root-x"
        className="scroll-x"
        fadeClassName="fade-x"
      >
        <p>x</p>
      </ScrollFadeBody>
    )
    expect(container.firstElementChild).toHaveClass("root-x")
    expect(container.querySelector(".scroll-x")).not.toBeNull()
    // top + bottom fade overlays both get fadeClassName.
    expect(container.querySelectorAll(".fade-x")).toHaveLength(2)
  })

  it("exposes the hidden-scrollbar utility class string", () => {
    expect(hiddenScrollbarClass).toContain("scrollbar-width:none")
  })
})
