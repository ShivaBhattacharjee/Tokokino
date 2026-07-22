import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `ShadowSection` — store-connected shadow controls: type grid, color rail,
 * intensity slider and a light-direction pad. Edits route through `applyStyle`.
 * The color-picker popover is stubbed; `EffectSlider` and the css-utils stay
 * real.
 */

type Shadow = {
  type: string
  intensity: number
  lightSource: string
  color: string
}

const store = vi.hoisted(() => {
  const shadow: Shadow = {
    type: "drop",
    intensity: 60,
    lightSource: "2-2",
    color: "#050505",
  }
  return {
    shadow,
    applyStyle: vi.fn(),
    selectedSlot: null,
    target: "all",
  }
})

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({ shadow: store.shadow }),
  useActiveCanvasId: () => "canvas-1",
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({ setShadow: vi.fn(), setMainScreenshotShadow: vi.fn() }),
}))

vi.mock("@/lib/editor/screenshot-style-target", () => ({
  useScreenshotStyleTarget: () => ({
    applyStyle: store.applyStyle,
    selectedSlot: store.selectedSlot,
    target: store.target,
  }),
}))

vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

import { ShadowSection } from "@/components/editor/inspector/shadow-section"

beforeEach(() => {
  store.shadow = {
    type: "drop",
    intensity: 60,
    lightSource: "2-2",
    color: "#050505",
  }
  store.selectedSlot = null
  store.target = "all"
})

afterEach(() => vi.clearAllMocks())

describe("ShadowSection", () => {
  it("renders all six shadow-type options", () => {
    render(<ShadowSection />)
    for (const label of ["None", "Drop", "Soft", "Hard", "Glow", "Float"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("highlights the active shadow type", () => {
    render(<ShadowSection />)
    expect(screen.getByRole("button", { name: "Drop" })).toHaveClass(
      "border-primary/40"
    )
    expect(screen.getByRole("button", { name: "Soft" })).not.toHaveClass(
      "border-primary/40"
    )
  })

  it("applies a chosen shadow type through applyStyle", async () => {
    const user = userEvent.setup()
    render(<ShadowSection />)

    await user.click(screen.getByRole("button", { name: "Soft" }))

    const patch = store.applyStyle.mock.calls[0][0] as { shadow: Shadow }
    expect(patch.shadow.type).toBe("soft")
  })

  it("Hard preset forces full intensity and a corner light source", async () => {
    const user = userEvent.setup()
    render(<ShadowSection />)

    await user.click(screen.getByRole("button", { name: "Hard" }))

    const patch = store.applyStyle.mock.calls[0][0] as { shadow: Shadow }
    expect(patch.shadow).toMatchObject({
      type: "hard",
      intensity: 100,
      lightSource: "2-0",
    })
  })

  it("commits an intensity edit through applyStyle", async () => {
    const user = userEvent.setup()
    render(<ShadowSection />)

    const slider = screen.getByRole("slider", { name: "Intensity" })
    slider.focus()
    // Controlled mock value stays at 60; Shift+Arrow nudges by step×10.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    const patch = store.applyStyle.mock.calls[
      store.applyStyle.mock.calls.length - 1
    ][0] as { shadow: Shadow }
    expect(patch.shadow.intensity).toBe(70)
  })

  it("renders the five color presets and applies one on click", async () => {
    const user = userEvent.setup()
    render(<ShadowSection />)

    expect(screen.getByLabelText("Use #050505 shadow")).toBeInTheDocument()
    await user.click(screen.getByLabelText("Use #2b3346 shadow"))

    const patch = store.applyStyle.mock.calls[0][0] as { shadow: Shadow }
    expect(patch.shadow.color).toBe("#2b3346")
  })

  it("enables the light-direction pad for directional shadows", () => {
    render(<ShadowSection />)
    expect(
      screen.getByRole("slider", { name: "Shadow light direction" })
    ).toHaveAttribute("aria-disabled", "false")
  })

  it("disables the light-direction pad for non-directional shadows", () => {
    store.shadow = {
      type: "glow",
      intensity: 60,
      lightSource: "2-2",
      color: "#050505",
    }
    render(<ShadowSection />)
    expect(
      screen.getByRole("slider", { name: "Shadow light direction" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("disables the light-direction pad when shadows are off", () => {
    store.shadow = {
      type: "none",
      intensity: 60,
      lightSource: "2-2",
      color: "#050505",
    }
    render(<ShadowSection />)
    expect(
      screen.getByRole("slider", { name: "Shadow light direction" })
    ).toHaveAttribute("aria-disabled", "true")
  })
})
