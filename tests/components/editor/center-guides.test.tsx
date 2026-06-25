import { act, render, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CenterGuides,
  useCenterGuides,
} from "@/components/editor/canvas/center-guides"

/**
 * `CenterGuides` — renders dashed center lines based on a `{ x, y }` flag.
 * `useCenterGuides` — state hook that only updates when the flags change.
 */
describe("CenterGuides", () => {
  it("renders nothing when both guides are off", () => {
    const { container } = render(
      <CenterGuides guides={{ x: false, y: false }} />
    )
    expect(container.querySelectorAll("div")).toHaveLength(0)
  })

  it("renders only the vertical guide when x is on", () => {
    const { container } = render(
      <CenterGuides guides={{ x: true, y: false }} />
    )
    const guides = container.querySelectorAll("div")
    expect(guides).toHaveLength(1)
    expect(guides[0]).toHaveClass("left-1/2")
    expect(guides[0]).toHaveAttribute("data-export-hidden", "true")
  })

  it("renders both guides when x and y are on", () => {
    const { container } = render(<CenterGuides guides={{ x: true, y: true }} />)
    expect(container.querySelectorAll("div")).toHaveLength(2)
  })
})

describe("useCenterGuides", () => {
  it("starts with both guides off", () => {
    const { result } = renderHook(() => useCenterGuides())
    expect(result.current[0]).toEqual({ x: false, y: false })
  })

  it("updates the guide state", () => {
    const { result } = renderHook(() => useCenterGuides())
    act(() => result.current[1]({ x: true, y: false }))
    expect(result.current[0]).toEqual({ x: true, y: false })
  })

  it("keeps the same state object reference when the value is unchanged", () => {
    const { result } = renderHook(() => useCenterGuides())
    const initial = result.current[0]
    act(() => result.current[1]({ x: false, y: false }))
    expect(result.current[0]).toBe(initial)
  })
})
