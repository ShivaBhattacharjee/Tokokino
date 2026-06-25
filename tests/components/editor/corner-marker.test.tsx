import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CornerMarker, CornerMarkers } from "@/components/editor/corner-marker"

/**
 * `CornerMarker` / `CornerMarkers` — pure SVG plus-marks. Props: corner,
 * className, size.
 */
describe("CornerMarker", () => {
  it("renders an aria-hidden svg sized by the size prop", () => {
    const { container } = render(<CornerMarker corner="top-left" size={16} />)
    const svg = container.querySelector("svg")!
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute("aria-hidden")
    expect(svg).toHaveAttribute("width", "16")
    expect(svg).toHaveAttribute("height", "16")
  })

  it("defaults size to 10", () => {
    const { container } = render(<CornerMarker corner="top-left" />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("width", "10")
  })

  it("applies the position classes for each corner", () => {
    const cases = {
      "top-left": ["top-0", "left-0"],
      "top-right": ["top-0", "right-0"],
      "bottom-left": ["bottom-0", "left-0"],
      "bottom-right": ["bottom-0", "right-0"],
    } as const

    for (const [corner, classes] of Object.entries(cases)) {
      const { container } = render(
        <CornerMarker corner={corner as keyof typeof cases} />
      )
      const svg = container.querySelector("svg")!
      expect(svg).toHaveClass(...classes)
    }
  })

  it("merges a custom className", () => {
    const { container } = render(
      <CornerMarker corner="top-right" className="text-red-500" />
    )
    expect(container.querySelector("svg")).toHaveClass("text-red-500")
  })
})

describe("CornerMarkers", () => {
  it("renders one marker at each of the four corners", () => {
    const { container } = render(<CornerMarkers />)
    expect(container.querySelectorAll("svg")).toHaveLength(4)
  })

  it("forwards className and size to every marker", () => {
    const { container } = render(
      <CornerMarkers className="text-blue-500" size={8} />
    )
    const svgs = container.querySelectorAll("svg")
    expect(svgs).toHaveLength(4)
    for (const svg of svgs) {
      expect(svg).toHaveClass("text-blue-500")
      expect(svg).toHaveAttribute("width", "8")
    }
  })
})
