import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `BackgroundSection` — None/Auto/Solid/Gradient/Image tabs that drive the
 * canvas background type. Sub-panels and store data are stubbed.
 */
const store = vi.hoisted(() => ({
  background: { type: "none", value: "" },
  screenshot: null as string | null,
  setBackground: vi.fn(),
}))

vi.mock("@/lib/editor/store", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useActiveCanvasField: (selector: (c: unknown) => unknown) =>
      selector({ background: store.background, screenshot: store.screenshot }),
    useEditorStore: (selector: (s: unknown) => unknown) =>
      selector({ setBackground: store.setBackground }),
  }
})

vi.mock(
  "@/components/editor/inspector/background-section-parts/gradient-panels",
  () => ({
    GradientPanel: () => <div data-testid="gradient-panel" />,
    AutoGradientPanel: () => <div data-testid="auto-gradient-panel" />,
  })
)
vi.mock(
  "@/components/editor/inspector/background-section-parts/image-background-panel",
  () => ({ ImageBackgroundPanel: () => <div data-testid="image-panel" /> })
)
vi.mock("@/components/editor/inspector/primitives", () => ({
  ColorPresetGrid: () => <div data-testid="color-grid" />,
}))

import { BackgroundSection } from "@/components/editor/inspector/background-section"

beforeEach(() => {
  store.background = { type: "none", value: "" }
  store.screenshot = null
})
afterEach(() => vi.clearAllMocks())

describe("BackgroundSection", () => {
  it("renders all five background tabs", () => {
    render(<BackgroundSection />)
    for (const label of ["None", "Auto", "Solid", "Gradient", "Image"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument()
    }
  })

  it("marks the active tab from the background type", () => {
    store.background = { type: "solid", value: "#fff" }
    render(<BackgroundSection />)
    expect(screen.getByRole("tab", { name: "Solid" })).toHaveAttribute(
      "data-state",
      "active"
    )
  })

  it("switches to a solid background with the first preset", async () => {
    const user = userEvent.setup()
    render(<BackgroundSection />)
    await user.click(screen.getByRole("tab", { name: "Solid" }))
    expect(store.setBackground).toHaveBeenCalledWith(
      expect.objectContaining({ type: "solid" })
    )
  })

  it("switches to a gradient background", async () => {
    const user = userEvent.setup()
    render(<BackgroundSection />)
    await user.click(screen.getByRole("tab", { name: "Gradient" }))
    expect(store.setBackground).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gradient" })
    )
  })

  it("clears the background when None is chosen", async () => {
    store.background = { type: "solid", value: "#fff" }
    const user = userEvent.setup()
    render(<BackgroundSection />)
    await user.click(screen.getByRole("tab", { name: "None" }))
    expect(store.setBackground).toHaveBeenCalledWith({
      type: "none",
      value: "",
    })
  })
})
