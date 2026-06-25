import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  assetFilterCss: () => "none",
}))

import { BackdropFilterGrid } from "@/components/editor/inspector/backdrop-section-parts/filter-grid"
import { BACKDROP_FILTERS } from "@/components/editor/inspector/backdrop-section-parts/constants"

describe("BackdropFilterGrid", () => {
  it("renders a tile for every backdrop filter", () => {
    render(<BackdropFilterGrid current="none" onChange={() => {}} />)
    for (const f of BACKDROP_FILTERS) {
      expect(screen.getByRole("button", { name: f.label })).toBeInTheDocument()
    }
  })

  it("highlights the active filter", () => {
    render(<BackdropFilterGrid current="sepia" onChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Sepia" })).toHaveClass(
      "border-primary/40"
    )
    expect(screen.getByRole("button", { name: "Original" })).not.toHaveClass(
      "border-primary/40"
    )
  })

  it("calls onChange with the selected filter id", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<BackdropFilterGrid current="none" onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: "B&W" }))
    expect(onChange).toHaveBeenCalledWith("bw")
  })
})
