import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { InnerLightingOverlay } from "@/components/editor/canvas/inner-lighting-overlay"

/**
 * `InnerLightingOverlay` — renders a positioned overlay div, or null when no
 * style is supplied. Props: style, className.
 */
describe("InnerLightingOverlay", () => {
  it("renders nothing when style is null", () => {
    const { container } = render(<InnerLightingOverlay style={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when style is undefined", () => {
    const { container } = render(<InnerLightingOverlay style={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders an overlay div applying the given style and className", () => {
    const { container } = render(
      <InnerLightingOverlay style={{ opacity: 0.5 }} className="extra-class" />
    )
    const el = container.firstElementChild as HTMLElement
    expect(el).not.toBeNull()
    expect(el).toHaveClass("extra-class", "absolute", "inset-0")
    expect(el.style.opacity).toBe("0.5")
    expect(el).toHaveAttribute("aria-hidden")
  })
})
