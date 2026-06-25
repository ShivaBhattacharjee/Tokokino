import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ToolbarButton,
  ToolbarDeleteButton,
  ToolbarDivider,
  ToolbarDuplicateButton,
  ToolbarLayerOrderMenu,
  bulkToolbarScale,
  floatingToolbarTransform,
} from "@/components/editor/toolbar/primitives"

const withTooltip = (ui: React.ReactNode) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

describe("bulkToolbarScale", () => {
  it("returns 1 for invalid or non-positive zoom", () => {
    expect(bulkToolbarScale(NaN)).toBe(1)
    expect(bulkToolbarScale(0)).toBe(1)
    expect(bulkToolbarScale(-3)).toBe(1)
  })

  it("clamps to the 0.5–1 range based on sqrt(zoom)", () => {
    expect(bulkToolbarScale(1)).toBe(1)
    expect(bulkToolbarScale(0.25)).toBe(0.5)
    expect(bulkToolbarScale(4)).toBe(1) // sqrt 2 clamped down to 1
    expect(bulkToolbarScale(0.04)).toBe(0.5) // sqrt 0.2 clamped up to 0.5
  })
})

describe("floatingToolbarTransform", () => {
  it("places above by default and below when flipped", () => {
    expect(floatingToolbarTransform(false)).toBe("translate(-50%, -100%)")
    expect(floatingToolbarTransform(true)).toBe("translate(-50%, 0)")
  })

  it("appends a scale when not 1", () => {
    expect(floatingToolbarTransform(false, 0.8)).toBe(
      "translate(-50%, -100%) scale(0.8)"
    )
  })
})

describe("ToolbarButton", () => {
  it("renders children and fires onClick", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <ToolbarButton onClick={onClick}>
        <span>icon</span>
      </ToolbarButton>
    )
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("reflects the active state via aria-pressed and data-state", () => {
    render(<ToolbarButton active>x</ToolbarButton>)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("aria-pressed", "true")
    expect(btn).toHaveAttribute("data-state", "active")
    expect(btn).toHaveClass("bg-accent")
  })

  it("applies destructive styling and disables", () => {
    render(
      <ToolbarButton destructive disabled>
        x
      </ToolbarButton>
    )
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveClass("text-red-500", "opacity-40")
  })
})

describe("ToolbarDivider", () => {
  it("renders a thin separator span", () => {
    const { container } = render(<ToolbarDivider />)
    const span = container.querySelector("span")!
    expect(span).toHaveClass("w-px")
  })
})

describe("ToolbarDeleteButton / ToolbarDuplicateButton", () => {
  it("fires onDelete once on click", async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    withTooltip(
      <ToolbarDeleteButton ariaLabel="Delete layer" onDelete={onDelete} />
    )
    await user.click(screen.getByRole("button", { name: "Delete layer" }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("fires onDuplicate on click", async () => {
    const onDuplicate = vi.fn()
    const user = userEvent.setup()
    withTooltip(
      <ToolbarDuplicateButton
        ariaLabel="Duplicate layer"
        onDuplicate={onDuplicate}
      />
    )
    await user.click(screen.getByRole("button", { name: "Duplicate layer" }))
    expect(onDuplicate).toHaveBeenCalledOnce()
  })
})

describe("ToolbarLayerOrderMenu", () => {
  it("opens and triggers bring-to-front / send-to-back", async () => {
    const onBringToFront = vi.fn()
    const onSendToBack = vi.fn()
    const user = userEvent.setup()
    withTooltip(
      <ToolbarLayerOrderMenu
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
      />
    )

    await user.click(screen.getByRole("button", { name: "More options" }))
    await user.click(screen.getByRole("button", { name: "Bring to front" }))
    expect(onBringToFront).toHaveBeenCalledOnce()

    await user.click(screen.getByRole("button", { name: "More options" }))
    await user.click(screen.getByRole("button", { name: "Send to back" }))
    expect(onSendToBack).toHaveBeenCalledOnce()
  })
})
