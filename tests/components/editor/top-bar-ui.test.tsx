import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(
              tag,
              Object.fromEntries(
                Object.entries(props).filter(
                  ([k]) =>
                    !["layoutId", "transition", "initial", "animate"].includes(
                      k
                    )
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

import { TooltipProvider } from "@/components/ui/tooltip"
import {
  IconAction,
  SaveActionRow,
  SegmentedRow,
  SummaryRow,
  SwitchRow,
  TopBarButton,
} from "@/components/editor/top-bar/ui"

const Icon = ({ className }: { className?: string }) => (
  <svg data-testid="icon" className={className} />
)
const withTooltip = (ui: React.ReactNode) =>
  render(<TooltipProvider>{ui}</TooltipProvider>)

describe("SegmentedRow", () => {
  const options = [
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" },
  ]

  it("renders all options and calls onChange on click", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SegmentedRow options={options} value="png" onChange={onChange} />)

    expect(screen.getByRole("button", { name: "PNG" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "JPG" }))
    expect(onChange).toHaveBeenCalledWith("jpg")
  })
})

describe("SummaryRow", () => {
  it("renders the label and value", () => {
    render(<SummaryRow label="Size" value="1920px" />)
    expect(screen.getByText("Size")).toBeInTheDocument()
    expect(screen.getByText("1920px")).toBeInTheDocument()
  })
})

describe("SwitchRow", () => {
  it("renders a labeled switch reflecting checked state", () => {
    render(<SwitchRow label="Auto-scroll" checked onCheckedChange={() => {}} />)
    const sw = screen.getByRole("switch", { name: "Auto-scroll" })
    expect(sw).toBeChecked()
  })

  it("toggles via onCheckedChange", async () => {
    const onCheckedChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SwitchRow
        label="Auto-scroll"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    )
    await user.click(screen.getByRole("switch"))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })
})

describe("TopBarButton", () => {
  it("renders label + icon and fires onClick", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    withTooltip(<TopBarButton label="Export" icon={Icon} onClick={onClick} />)
    expect(screen.getByText("Export")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("disables the button", () => {
    withTooltip(<TopBarButton label="Export" icon={Icon} disabled />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})

describe("IconAction", () => {
  it("renders an accessible icon button and fires onClick", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    withTooltip(<IconAction label="Undo" icon={Icon} onClick={onClick} />)
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    withTooltip(
      <IconAction label="Undo" icon={Icon} disabled onClick={onClick} />
    )
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Undo" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })
})

describe("SaveActionRow", () => {
  it("renders title and description and fires onClick", async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <SaveActionRow
        icon={Icon}
        title="Save as preset"
        description="Reuse this layout"
        onClick={onClick}
      />
    )
    expect(screen.getByText("Save as preset")).toBeInTheDocument()
    expect(screen.getByText("Reuse this layout")).toBeInTheDocument()
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("shows a saving state and disables while loading", () => {
    render(
      <SaveActionRow
        icon={Icon}
        title="Save draft"
        description="x"
        loading
        onClick={() => {}}
      />
    )
    expect(screen.getByText("Saving…")).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
