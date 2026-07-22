import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

import { GradientCustomizerPopover } from "@/components/editor/inspector/background-section-parts/gradient-customizer-popover"

const baseConfig = { angle: 90, colors: ["#ff0000", "#00ff00"] }

function renderPopover(
  props: Partial<React.ComponentProps<typeof GradientCustomizerPopover>> = {}
) {
  return render(
    <GradientCustomizerPopover
      ariaLabel="Customize gradient"
      config={baseConfig}
      canReset
      onAngleChange={() => {}}
      onColorChange={() => {}}
      onReset={() => {}}
      {...props}
    />
  )
}

async function open() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Customize gradient" }))
  return user
}

describe("GradientCustomizerPopover", () => {
  it("opens the popover showing the angle and reset", async () => {
    renderPopover()
    await open()
    expect(screen.getByText("Angle")).toBeInTheDocument()
    const angle = screen.getByRole("slider", { name: "Angle" })
    expect(angle).toHaveAttribute("aria-valuenow", "90")
    expect(angle).toHaveAttribute("aria-valuetext", "90°")
    expect(
      screen.getByRole("button", { name: "Reset gradient" })
    ).toBeInTheDocument()
  })

  it("commits an angle edit via onAngleChange", async () => {
    const onAngleChange = vi.fn()
    renderPopover({ onAngleChange })
    const user = await open()

    const angle = screen.getByRole("slider", { name: "Angle" })
    angle.focus()
    // Controlled mock value stays at 90; Shift+Arrow nudges by step×10.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")
    expect(onAngleChange).toHaveBeenCalled()
    expect(onAngleChange).toHaveBeenLastCalledWith(100)
  })

  it("disables reset when canReset is false", async () => {
    renderPopover({ canReset: false })
    await open()
    expect(
      screen.getByRole("button", { name: "Reset gradient" })
    ).toBeDisabled()
  })

  it("calls onReset when reset is clicked", async () => {
    const onReset = vi.fn()
    renderPopover({ onReset })
    const user = await open()
    await user.click(screen.getByRole("button", { name: "Reset gradient" }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
