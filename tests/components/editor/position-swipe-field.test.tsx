import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { PositionSwipeField } from "@/components/editor/position-swipe-field"

/**
 * `PositionSwipeField` — a 2D pad exposing an ARIA slider. Props: ariaLabel,
 * className, disabled, value, onChange, onPreview. Keyboard arrows nudge the
 * point; Home recenters.
 */
describe("PositionSwipeField", () => {
  it("exposes an accessible slider with the averaged position", () => {
    render(
      <PositionSwipeField
        ariaLabel="Light position"
        value={{ xPct: 20, yPct: 40 }}
        onChange={() => {}}
      />
    )
    const slider = screen.getByRole("slider", { name: "Light position" })
    expect(slider).toHaveAttribute("aria-valuenow", "30") // (20+40)/2
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "20% horizontal, 40% vertical"
    )
  })

  it("defaults a null value to the center", () => {
    render(
      <PositionSwipeField ariaLabel="Pos" value={null} onChange={() => {}} />
    )
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "50")
  })

  it("nudges right by 5% on ArrowRight", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PositionSwipeField
        ariaLabel="Pos"
        value={{ xPct: 50, yPct: 50 }}
        onChange={onChange}
      />
    )
    screen.getByRole("slider").focus()
    await user.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith({ xPct: 55, yPct: 50 })
  })

  it("uses a 10% step when Shift is held", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PositionSwipeField
        ariaLabel="Pos"
        value={{ xPct: 50, yPct: 50 }}
        onChange={onChange}
      />
    )
    screen.getByRole("slider").focus()
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(onChange).toHaveBeenCalledWith({ xPct: 50, yPct: 60 })
  })

  it("recenters on Home", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PositionSwipeField
        ariaLabel="Pos"
        value={{ xPct: 10, yPct: 90 }}
        onChange={onChange}
      />
    )
    screen.getByRole("slider").focus()
    await user.keyboard("{Home}")
    expect(onChange).toHaveBeenCalledWith({ xPct: 50, yPct: 50 })
  })

  it("clamps movement within 0–100", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PositionSwipeField
        ariaLabel="Pos"
        value={{ xPct: 2, yPct: 50 }}
        onChange={onChange}
      />
    )
    screen.getByRole("slider").focus()
    await user.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith({ xPct: 0, yPct: 50 })
  })

  it("ignores keyboard input when disabled", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <PositionSwipeField
        ariaLabel="Pos"
        disabled
        value={{ xPct: 50, yPct: 50 }}
        onChange={onChange}
      />
    )
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-disabled", "true")
    expect(slider).toHaveAttribute("tabindex", "-1")
    await user.keyboard("{ArrowRight}")
    expect(onChange).not.toHaveBeenCalled()
  })
})
