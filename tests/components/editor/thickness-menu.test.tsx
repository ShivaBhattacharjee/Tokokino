import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ThicknessMenuSection } from "@/components/editor/annotation-shape/thickness-menu"
import { ANNOTATION_STROKES } from "@/lib/editor/presets"

/**
 * `ThicknessMenuSection` — stroke-thickness presets + slider. Props: value,
 * color, onChange.
 */
describe("ThicknessMenuSection", () => {
  it("shows the current value and a preset button per stroke width", () => {
    render(<ThicknessMenuSection value={4} color="#000" onChange={() => {}} />)
    expect(screen.getByText("4px")).toBeInTheDocument()
    for (const w of ANNOTATION_STROKES) {
      expect(
        screen.getByRole("button", { name: `${w}px thickness` })
      ).toBeInTheDocument()
    }
  })

  it("highlights the active stroke width", () => {
    render(<ThicknessMenuSection value={7} color="#000" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "7px thickness" })).toHaveClass(
      "border-border"
    )
    expect(
      screen.getByRole("button", { name: "2px thickness" })
    ).not.toHaveClass("border-border")
  })

  it("calls onChange when a preset is clicked", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThicknessMenuSection value={2} color="#000" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "11px thickness" }))
    expect(onChange).toHaveBeenCalledWith(11)
  })

  it("exposes a slider reflecting the value within 1–24", () => {
    render(<ThicknessMenuSection value={11} color="#000" onChange={() => {}} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuenow", "11")
    expect(slider).toHaveAttribute("aria-valuemin", "1")
    expect(slider).toHaveAttribute("aria-valuemax", "24")
  })
})
