import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EffectSlider } from "@/components/editor/inspector/effect-slider"

/**
 * `EffectSlider` — elastic labeled slider. Props: label, value, onChange,
 * onPreview, min, max, step, suffix, disabled, className, sliderClassName.
 * Suffix defaults to "%" when max === 100, else "".
 */
describe("EffectSlider", () => {
  it("renders the label and the value with a default % suffix", () => {
    render(<EffectSlider label="Opacity" value={60} onChange={() => {}} />)

    expect(screen.getByText("Opacity")).toBeInTheDocument()
    expect(screen.getByText("60%")).toBeInTheDocument()
  })

  it("omits the % suffix when max is not 100", () => {
    render(<EffectSlider label="Blur" value={8} onChange={() => {}} max={20} />)
    expect(screen.getByText("Blur")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(screen.queryByText("8%")).not.toBeInTheDocument()
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
    expect(screen.getByText("45°")).toBeInTheDocument()
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

  it("when disabled, shows a static readout and disables the slider", () => {
    render(
      <EffectSlider label="Opacity" value={30} onChange={() => {}} disabled />
    )

    expect(screen.getByText("30%")).toBeInTheDocument()
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("data-disabled")
    expect(slider).toHaveAttribute("aria-disabled", "true")
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
