import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `BorderSection` — store-connected inspector section for border radius, width,
 * inner padding, style and color. Routes edits through
 * `useScreenshotStyleTarget().applyStyle`. The async color-sampling and the
 * `ColorPresetGrid` child are mocked so the test focuses on this section.
 */

type BorderState = {
  color: string | null
  width: number
  padding: number
  style?: string
}

type Canvas = {
  border: BorderState
  borderRadius: number
  background: { type: string; value?: string; thumbUrl?: string }
  screenshot: string | null
}

const defaultBorder: BorderState = {
  color: "#f08a9a",
  width: 4,
  padding: 8,
  style: "solid",
}

const store = vi.hoisted(() => {
  const initialBorder: BorderState = {
    color: "#f08a9a",
    width: 4,
    padding: 8,
    style: "solid",
  }
  const canvas: Canvas = {
    border: initialBorder,
    borderRadius: 12,
    background: { type: "none" },
    screenshot: null,
  }
  return {
    canvas,
    applyStyle: vi.fn(),
    selectedSlot: null,
    colorGridProps: null as Record<string, unknown> | null,
  }
})

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector(store.canvas),
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setBorder: vi.fn(),
      setBorderRadius: vi.fn(),
      setMainScreenshotBorder: vi.fn(),
      setMainScreenshotBorderRadius: vi.fn(),
    }),
  sampleImageColorsRaw: vi.fn(() => Promise.resolve([])),
}))

vi.mock("@/lib/editor/screenshot-style-target", () => ({
  useScreenshotStyleTarget: () => ({
    applyStyle: store.applyStyle,
    selectedSlot: store.selectedSlot,
  }),
}))

vi.mock("@/components/editor/inspector/primitives", () => ({
  SubHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ColorPresetGrid: (props: Record<string, unknown>) => {
    store.colorGridProps = props
    return <div data-testid="color-grid" />
  },
}))

import { BorderSection } from "@/components/editor/inspector/border-section"

beforeEach(() => {
  store.canvas = {
    border: { ...defaultBorder },
    borderRadius: 12,
    background: { type: "none" },
    screenshot: null,
  }
  store.selectedSlot = null
  store.colorGridProps = null
})

afterEach(() => vi.clearAllMocks())

describe("BorderSection", () => {
  it("renders the radius, width and inner-padding readouts", () => {
    render(<BorderSection />)
    expect(screen.getByText("Radius")).toBeInTheDocument()
    expect(screen.getByText("Width")).toBeInTheDocument()
    expect(screen.getByText("Inner Padding")).toBeInTheDocument()

    const radius = screen.getByRole("slider", { name: "Radius" })
    const width = screen.getByRole("slider", { name: "Width" })
    const padding = screen.getByRole("slider", { name: "Inner Padding" })
    expect(radius).toHaveAttribute("aria-valuenow", "12")
    expect(radius).toHaveAttribute("aria-valuetext", "12px")
    expect(width).toHaveAttribute("aria-valuenow", "4")
    expect(width).toHaveAttribute("aria-valuetext", "4px")
    expect(padding).toHaveAttribute("aria-valuenow", "8")
    expect(padding).toHaveAttribute("aria-valuetext", "8px")
  })

  it("routes a radius edit through applyStyle", async () => {
    const user = userEvent.setup()
    render(<BorderSection />)

    const radius = screen.getByRole("slider", { name: "Radius" })
    radius.focus()
    // Controlled mock value stays at 12; Shift+Arrow nudges by step×10.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ borderRadius: 22 })
  })

  it("clamps the radius edit to the 0–48 range", async () => {
    const user = userEvent.setup()
    render(<BorderSection />)

    const radius = screen.getByRole("slider", { name: "Radius" })
    radius.focus()
    await user.keyboard("{End}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ borderRadius: 48 })
  })

  it("renders all seven border-style options", () => {
    render(<BorderSection />)
    for (const label of [
      "None",
      "Solid",
      "Dashed",
      "Dotted",
      "Double",
      "Groove",
      "Ridge",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("disables the border (color: null) when None is clicked", async () => {
    const user = userEvent.setup()
    render(<BorderSection />)

    await user.click(screen.getByRole("button", { name: "None" }))

    const patch = store.applyStyle.mock.calls[0][0] as { border: BorderState }
    expect(patch.border.color).toBeNull()
  })

  it("sets the style and a default color when enabling a style from a disabled border", async () => {
    store.canvas.border = { color: null, width: 4, padding: 8 }
    const user = userEvent.setup()
    render(<BorderSection />)

    await user.click(screen.getByRole("button", { name: "Dashed" }))

    const patch = store.applyStyle.mock.calls[0][0] as { border: BorderState }
    expect(patch.border.style).toBe("dashed")
    expect(patch.border.color).toBe("#f08a9a")
  })

  it("passes six presets and the current color to the color grid", () => {
    render(<BorderSection />)
    expect(screen.getByTestId("color-grid")).toBeInTheDocument()
    const props = store.colorGridProps!
    expect((props.presets as string[]).length).toBe(6)
    expect(props.selected).toBe("#f08a9a")
  })

  it("reports no selected color when the border is disabled", () => {
    store.canvas.border = { color: null, width: 4, padding: 8 }
    render(<BorderSection />)
    expect(store.colorGridProps!.selected).toBeNull()
  })
})
