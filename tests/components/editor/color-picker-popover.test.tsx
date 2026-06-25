import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

// The kibo-ui colour picker uses canvas internals; stub it.
vi.mock("@/components/kibo-ui/color-picker", () => ({
  ColorPicker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="color-picker">{children}</div>
  ),
  ColorPickerSelection: () => <div />,
  ColorPickerEyeDropper: () => <div />,
  ColorPickerHue: () => <div />,
  ColorPickerAlpha: () => <div />,
  ColorPickerFormat: () => <div />,
}))

import { ColorPickerPopover } from "@/components/editor/color-picker-popover"

describe("ColorPickerPopover", () => {
  it("renders its trigger children", () => {
    render(
      <ColorPickerPopover value="#ff0000" onChange={() => {}}>
        <button>Open picker</button>
      </ColorPickerPopover>
    )
    expect(
      screen.getByRole("button", { name: "Open picker" })
    ).toBeInTheDocument()
    // Closed: the picker body is not mounted.
    expect(screen.queryByTestId("color-picker")).not.toBeInTheDocument()
  })

  it("opens the colour picker when the trigger is clicked", async () => {
    const user = userEvent.setup()
    render(
      <ColorPickerPopover value="#00ff00" onChange={() => {}}>
        <button>Open picker</button>
      </ColorPickerPopover>
    )
    await user.click(screen.getByRole("button", { name: "Open picker" }))
    expect(screen.getByTestId("color-picker")).toBeInTheDocument()
  })

  it("renders an optional footer inside the open popover", async () => {
    const user = userEvent.setup()
    render(
      <ColorPickerPopover
        value="#0000ff"
        onChange={() => {}}
        footer={<div data-testid="footer">footer</div>}
      >
        <button>Open picker</button>
      </ColorPickerPopover>
    )
    await user.click(screen.getByRole("button", { name: "Open picker" }))
    expect(screen.getByTestId("footer")).toBeInTheDocument()
  })
})
