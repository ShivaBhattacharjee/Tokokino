import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileEnhancePanel` — grid of enhance presets driven by the store.
 */
const store = vi.hoisted(() => ({
  enhance: "off",
  setEnhance: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({ enhance: store.enhance }),
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({ setEnhance: store.setEnhance }),
}))

import { MobileEnhancePanel } from "@/components/editor/mobile-controls/enhance-panel"
import { ENHANCE_PRESETS } from "@/components/editor/mobile-controls/categories"

beforeEach(() => {
  store.enhance = "off"
})
afterEach(() => vi.clearAllMocks())

describe("MobileEnhancePanel", () => {
  it("renders a button for every enhance preset", () => {
    render(<MobileEnhancePanel />)
    for (const preset of ENHANCE_PRESETS) {
      expect(
        screen.getByRole("button", { name: preset.label })
      ).toBeInTheDocument()
    }
  })

  it("highlights the active preset", () => {
    store.enhance = "vivid"
    render(<MobileEnhancePanel />)
    expect(screen.getByRole("button", { name: "Vivid" })).toHaveClass(
      "border-primary/40"
    )
    expect(screen.getByRole("button", { name: "Off" })).not.toHaveClass(
      "border-primary/40"
    )
  })

  it("applies a preset on click", async () => {
    const user = userEvent.setup()
    render(<MobileEnhancePanel />)
    await user.click(screen.getByRole("button", { name: "Dramatic" }))
    expect(store.setEnhance).toHaveBeenCalledWith("dramatic")
  })
})
