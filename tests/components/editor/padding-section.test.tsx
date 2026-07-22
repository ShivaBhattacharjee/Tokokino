import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `PaddingSection` — a representative store-connected inspector section. It
 * reads the active canvas's `padding` (or the selected slot's padding) and
 * routes edits through `useScreenshotStyleTarget().applyStyle`. This test
 * mocks the store hooks + the style-target hook, which is the pattern reused
 * for the other inspector sections.
 */

const store = vi.hoisted(() => ({
  canvas: { padding: 24 },
  setPadding: vi.fn(),
  setMainScreenshotPadding: vi.fn(),
  applyStyle: vi.fn(),
  selectedSlot: null as { id: string; padding?: number } | null,
  target: "all",
}))

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector(store.canvas),
  useActiveCanvasId: () => "canvas-1",
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setPadding: store.setPadding,
      setMainScreenshotPadding: store.setMainScreenshotPadding,
    }),
}))

vi.mock("@/lib/editor/screenshot-style-target", () => ({
  useScreenshotStyleTarget: () => ({
    applyStyle: store.applyStyle,
    selectedSlot: store.selectedSlot,
    target: store.target,
  }),
}))

import { PaddingSection } from "@/components/editor/inspector/padding-section"

beforeEach(() => {
  store.canvas = { padding: 24 }
  store.selectedSlot = null
  store.target = "all"
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("PaddingSection", () => {
  it("renders the Inset label and the current padding value", () => {
    render(<PaddingSection />)
    expect(screen.getByText("Inset")).toBeInTheDocument()
    const slider = screen.getByRole("slider", { name: "Inset" })
    expect(slider).toHaveAttribute("aria-valuenow", "24")
    expect(slider).toHaveAttribute("aria-valuetext", "24px")
  })

  it("renders the four quick-preset buttons", () => {
    render(<PaddingSection />)
    for (const q of [16, 40, 80, 120]) {
      expect(
        screen.getByRole("button", { name: String(q) })
      ).toBeInTheDocument()
    }
  })

  it("applies a quick preset through applyStyle", async () => {
    const user = userEvent.setup()
    render(<PaddingSection />)

    await user.click(screen.getByRole("button", { name: "80" }))

    expect(store.applyStyle).toHaveBeenCalledTimes(1)
    expect(store.applyStyle.mock.calls[0][0]).toEqual({ padding: 80 })
  })

  it("highlights the quick preset matching the current padding", () => {
    store.canvas = { padding: 40 }
    render(<PaddingSection />)

    expect(screen.getByRole("button", { name: "40" })).toHaveClass("bg-primary")
    expect(screen.getByRole("button", { name: "80" })).not.toHaveClass(
      "bg-primary"
    )
  })

  it("commits an edited value through applyStyle", async () => {
    const user = userEvent.setup()
    render(<PaddingSection />)

    const slider = screen.getByRole("slider", { name: "Inset" })
    slider.focus()
    // Controlled mock value stays at 24; Shift+Arrow nudges by step×10.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ padding: 34 })
  })

  it("clamps an edited value to the 0–240 range", async () => {
    const user = userEvent.setup()
    render(<PaddingSection />)

    const slider = screen.getByRole("slider", { name: "Inset" })
    slider.focus()
    await user.keyboard("{End}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ padding: 240 })
  })

  it("prefers the selected slot's padding over the canvas padding", () => {
    store.selectedSlot = { id: "slot-1", padding: 64 }
    store.target = "slot"
    render(<PaddingSection />)

    const slider = screen.getByRole("slider", { name: "Inset" })
    expect(slider).toHaveAttribute("aria-valuenow", "64")
    expect(slider).toHaveAttribute("aria-valuetext", "64px")
  })

  it("routes the main and canvas setters through applyStyle's callbacks", async () => {
    // applyStyle here forwards to the canvas callback (target = all).
    store.applyStyle.mockImplementation(
      (_patch: unknown, _main: () => void, all: () => void) => all()
    )
    const user = userEvent.setup()
    render(<PaddingSection />)

    await user.click(screen.getByRole("button", { name: "16" }))

    expect(store.setPadding).toHaveBeenCalledWith(16)
  })
})
