import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

// The color-picker popover wraps a trigger; stub it to render its children.
vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

import {
  ColorPresetGrid,
  PopoverHeader,
  Section,
  SubHeader,
} from "@/components/editor/inspector/primitives"

const Icon = ({ className }: { className?: string }) => (
  <svg data-testid="icon" className={className} />
)

describe("Section", () => {
  it("renders the title and shows children when open by default", () => {
    render(
      <Section icon={Icon} title="Background">
        <p data-testid="body">body</p>
      </Section>
    )
    expect(screen.getByText("Background")).toBeInTheDocument()
    expect(screen.getByTestId("body")).toBeInTheDocument()
  })

  it("hides children when defaultOpen is false", () => {
    render(
      <Section icon={Icon} title="Shadow" defaultOpen={false}>
        <p data-testid="body">body</p>
      </Section>
    )
    expect(screen.queryByTestId("body")).not.toBeInTheDocument()
  })

  it("toggles open/closed when the header is clicked", async () => {
    const user = userEvent.setup()
    render(
      <Section icon={Icon} title="Shadow" defaultOpen={false}>
        <p data-testid="body">body</p>
      </Section>
    )
    await user.click(screen.getByText("Shadow"))
    expect(screen.getByTestId("body")).toBeInTheDocument()
  })

  it("stays open and ignores clicks when not collapsible", async () => {
    const user = userEvent.setup()
    render(
      <Section icon={Icon} title="Locked" collapsible={false} defaultOpen>
        <p data-testid="body">body</p>
      </Section>
    )
    expect(screen.getByTestId("body")).toBeInTheDocument()
    await user.click(screen.getByText("Locked"))
    expect(screen.getByTestId("body")).toBeInTheDocument()
  })
})

describe("SubHeader", () => {
  it("renders children and optional trailing content", () => {
    render(
      <SubHeader trailing={<span data-testid="trailing">x</span>}>
        Style
      </SubHeader>
    )
    expect(screen.getByText("Style")).toBeInTheDocument()
    expect(screen.getByTestId("trailing")).toBeInTheDocument()
  })
})

describe("PopoverHeader", () => {
  it("renders title and description", () => {
    render(<PopoverHeader title="Gradient" description="Tune the colors" />)
    expect(screen.getByText("Gradient")).toBeInTheDocument()
    expect(screen.getByText("Tune the colors")).toBeInTheDocument()
  })

  it("renders no reset button when onReset is omitted", () => {
    render(<PopoverHeader title="X" description="Y" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("calls onReset when the reset button is clicked", async () => {
    const onReset = vi.fn()
    const user = userEvent.setup()
    render(
      <PopoverHeader
        title="X"
        description="Y"
        onReset={onReset}
        resetTitle="Reset gradient"
      />
    )
    await user.click(screen.getByRole("button", { name: "Reset gradient" }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})

describe("ColorPresetGrid", () => {
  const presets = ["#ffffff", "#000000", "#FF0000"]

  it("renders one tile per unique preset plus the custom picker", () => {
    render(
      <ColorPresetGrid
        presets={[...presets, "#FFFFFF"]} // duplicate (case-insensitive)
        selected="#ffffff"
        onSelect={() => {}}
        customColor="#123456"
        onCustomColor={() => {}}
        isCustom={false}
      />
    )
    // 3 unique presets + 1 custom picker button
    expect(screen.getAllByRole("button")).toHaveLength(4)
    expect(screen.getByLabelText("Custom color")).toBeInTheDocument()
  })

  it("calls onSelect with the clicked color", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <ColorPresetGrid
        presets={presets}
        selected={null}
        onSelect={onSelect}
        customColor="#123456"
        onCustomColor={() => {}}
        isCustom={false}
      />
    )
    // buttons are color tiles; click the first (lowercased "#ffffff")
    await user.click(screen.getAllByRole("button")[0])
    expect(onSelect).toHaveBeenCalledWith("#ffffff")
  })

  it("uses a custom label when provided", () => {
    render(
      <ColorPresetGrid
        presets={presets}
        selected={null}
        onSelect={() => {}}
        customColor="#123456"
        onCustomColor={() => {}}
        isCustom
        customLabel="Custom border color"
      />
    )
    expect(screen.getByLabelText("Custom border color")).toBeInTheDocument()
  })
})
