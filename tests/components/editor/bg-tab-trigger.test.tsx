import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Tabs, TabsList } from "@/components/ui/tabs"
import { BgTabTrigger } from "@/components/editor/inspector/background-section-parts/bg-tab-trigger"

/**
 * `BgTabTrigger` — a styled `TabsTrigger`. Props: value, label, children.
 * Rendered inside a Tabs context.
 */
function renderInTabs(ui: React.ReactNode) {
  return render(
    <Tabs defaultValue="solid">
      <TabsList>{ui}</TabsList>
    </Tabs>
  )
}

describe("BgTabTrigger", () => {
  it("renders the label and icon children", () => {
    renderInTabs(
      <BgTabTrigger value="solid" label="Solid">
        <svg data-testid="icon" />
      </BgTabTrigger>
    )
    expect(screen.getByText("Solid")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  it("acts as a tab and is selected when its value is active", () => {
    renderInTabs(
      <>
        <BgTabTrigger value="solid" label="Solid">
          <svg />
        </BgTabTrigger>
        <BgTabTrigger value="gradient" label="Gradient">
          <svg />
        </BgTabTrigger>
      </>
    )
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(2)
    expect(screen.getByRole("tab", { name: "Solid" })).toHaveAttribute(
      "data-state",
      "active"
    )
    expect(screen.getByRole("tab", { name: "Gradient" })).toHaveAttribute(
      "data-state",
      "inactive"
    )
  })
})
