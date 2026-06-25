import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EffectSlider } from "@/components/editor/inspector/effect-slider"

/**
 * `EffectSlider` — labeled slider + editable readout. Props: label, value,
 * onChange, onPreview, min, max, step, suffix, disabled, className,
 * sliderClassName. Suffix defaults to "%" when max === 100, else "".
 */
describe("EffectSlider", () => {
  it("renders the label and the value with a default % suffix", () => {
    render(<EffectSlider label="Opacity" value={60} onChange={() => {}} />)

    expect(screen.getByText("Opacity")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /60%/ })).toBeInTheDocument()
  })

  it("omits the % suffix when max is not 100", () => {
    render(<EffectSlider label="Blur" value={8} onChange={() => {}} max={20} />)
    const readout = screen.getByRole("button", { name: "8" })
    expect(readout).toBeInTheDocument()
    expect(readout).not.toHaveTextContent("%")
  })

  it("uses an explicit suffix over the default", () => {
    render(
      <EffectSlider
        label="Angle"
        value={45}
        onChange={() => {}}
        max={180}
        suffix="°"
      />
    )
    expect(screen.getByRole("button", { name: /45°/ })).toBeInTheDocument()
  })

  it("exposes a slider with the correct aria range", () => {
    render(
      <EffectSlider
        label="Saturation"
        value={120}
        onChange={() => {}}
        min={0}
        max={200}
      />
    )
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("aria-valuenow", "120")
    expect(slider).toHaveAttribute("aria-valuemin", "0")
    expect(slider).toHaveAttribute("aria-valuemax", "200")
  })

  it("commits an edited readout through onChange", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EffectSlider label="Opacity" value={50} onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: /50%/ }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "75{Enter}")

    expect(onChange).toHaveBeenCalledWith(75)
  })

  it("when disabled, shows a static readout (not editable) and disables the slider", () => {
    render(
      <EffectSlider label="Opacity" value={30} onChange={() => {}} disabled />
    )

    // No click-to-edit button.
    expect(
      screen.queryByRole("button", { name: "Click to edit" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTitle("Click to edit")).not.toBeInTheDocument()
    // Static value still visible.
    expect(screen.getByText(/30%/)).toBeInTheDocument()
    // Slider is disabled.
    expect(screen.getByRole("slider")).toHaveAttribute("data-disabled")
  })

  it("applies className to the wrapper", () => {
    const { container } = render(
      <EffectSlider
        label="Opacity"
        value={10}
        onChange={() => {}}
        className="wrap-x"
      />
    )
    expect(container.querySelector(".wrap-x")).not.toBeNull()
  })
})
