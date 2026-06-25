import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MobileToolPopoverButton } from "@/components/editor/mobile-controls/tool-popover-button"

/**
 * `MobileToolPopoverButton` — a labeled icon button. Props: label, icon,
 * active, disabled, onClick.
 */
const Icon = ({ className }: { className?: string }) => (
  <svg data-testid="icon" className={className} />
)

describe("MobileToolPopoverButton", () => {
  it("renders the label and icon", () => {
    render(
      <MobileToolPopoverButton label="Crop" icon={Icon} onClick={() => {}} />
    )
    expect(screen.getByText("Crop")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("sets aria-label from a string label and reflects active via aria-pressed", () => {
    render(
      <MobileToolPopoverButton
        label="Crop"
        icon={Icon}
        active
        onClick={() => {}}
      />
    )
    const btn = screen.getByRole("button", { name: "Crop" })
    expect(btn).toHaveAttribute("aria-pressed", "true")
    expect(btn).toHaveClass("border-primary/40")
  })

  it("defaults aria-pressed to false", () => {
    render(
      <MobileToolPopoverButton label="Crop" icon={Icon} onClick={() => {}} />
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
  })

  it("omits aria-label for non-string labels", () => {
    render(
      <MobileToolPopoverButton
        label={<span>node</span>}
        icon={Icon}
        onClick={() => {}}
      />
    )
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-label")
  })

  it("fires onClick when pressed", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <MobileToolPopoverButton label="Crop" icon={Icon} onClick={onClick} />
    )
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <MobileToolPopoverButton
        label="Crop"
        icon={Icon}
        disabled
        onClick={onClick}
      />
    )
    await user.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
