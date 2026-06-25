import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ImageFitPicker } from "@/components/editor/toolbar/image-fit-picker"

/**
 * `ImageFitPicker` — three-way contain/cover/fill toggle. Props: value, onChange.
 */
describe("ImageFitPicker", () => {
  it("renders the three fit options", () => {
    render(<ImageFitPicker value="contain" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Contain" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cover" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fill" })).toBeInTheDocument()
  })

  it("highlights the active value", () => {
    render(<ImageFitPicker value="cover" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Cover" })).toHaveClass(
      "border-primary/40"
    )
    expect(screen.getByRole("button", { name: "Contain" })).not.toHaveClass(
      "border-primary/40"
    )
  })

  it("calls onChange with the chosen fit", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ImageFitPicker value="contain" onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: "Fill" }))
    expect(onChange).toHaveBeenCalledWith("fill")

    await user.click(screen.getByRole("button", { name: "Cover" }))
    expect(onChange).toHaveBeenCalledWith("cover")
  })
})
