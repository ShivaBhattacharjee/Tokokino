import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// next/link and next/image render heavy framework wrappers — stub them to
// plain DOM so we can assert the brand markup.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}))

vi.mock("motion/react", async () => {
  const React = await import("react")
  const strip = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(props)) {
      if (
        !["initial", "animate", "exit", "transition", "variants"].includes(key)
      ) {
        out[key] = props[key]
      }
    }
    return out
  }
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(tag, strip(props), children as React.ReactNode),
      }
    ),
  }
})

import { BrandLogo } from "@/components/editor/brand-logo"

/**
 * `BrandLogo` — links home, shows the logo image + animated "Tokokino"
 * wordmark. Props: className, markClassName, wordmarkClassName.
 */
describe("BrandLogo", () => {
  it("links to the home page with an accessible label", () => {
    render(<BrandLogo />)
    const link = screen.getByRole("link", { name: "Tokokino" })
    expect(link).toHaveAttribute("href", "/")
  })

  it("renders the logo image with the wordmark as alt text", () => {
    render(<BrandLogo />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("alt", "Tokokino")
    expect(img).toHaveAttribute("src", "/logo.png")
  })

  it("renders the full wordmark text", () => {
    const { container } = render(<BrandLogo />)
    // The wordmark is split per-letter; the link's text content joins them.
    expect(container.textContent).toContain("Tokokino")
  })

  it("applies className, markClassName and wordmarkClassName", () => {
    render(
      <BrandLogo
        className="root-x"
        markClassName="mark-x"
        wordmarkClassName="word-x"
      />
    )
    expect(screen.getByRole("link")).toHaveClass("root-x")
    expect(screen.getByRole("img")).toHaveClass("mark-x")
    expect(document.querySelector(".word-x")).not.toBeNull()
  })
})
