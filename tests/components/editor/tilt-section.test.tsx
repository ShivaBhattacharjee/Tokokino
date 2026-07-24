import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `TiltSection` — store-connected 3D tilt + scale controls. Note the axis
 * mapping: the "Rotate X" row drives `tilt.ry` and "Rotate Y" drives
 * `tilt.rx`. Every edit — tilt, scale, and Z-rotation, for the main, all, or a
 * slot — routes through a single `applyStyle(patch)`; the store resolves the
 * target in `applyScreenshotStyle`.
 */

type Tilt = { rx: number; ry: number; rz: number }
type Slot = { id: string; tilt: Tilt; scale: number; rotation: number }

const store = vi.hoisted(() => {
  const tilt: Tilt = { rx: 5, ry: 10, rz: 15 }
  return {
    tilt,
    scale: 120,
    applyStyle: vi.fn(),
    selectedSlot: null as Slot | null,
    target: "all",
    setters: {
      setTilt: vi.fn(),
      setScale: vi.fn(),
      updateScreenshotSlot: vi.fn(),
      setScreenshotTilt: vi.fn(),
      setScreenshotScale: vi.fn(),
      setScreenshotRotation: vi.fn(),
    },
  }
})

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({ tilt: store.tilt, scale: store.scale }),
  useActiveCanvasId: () => "canvas-1",
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector(store.setters),
}))

vi.mock("@/lib/editor/screenshot-style-target", () => ({
  useScreenshotStyleTarget: () => ({
    applyStyle: store.applyStyle,
    selectedSlot: store.selectedSlot,
    target: store.target,
  }),
}))

import { TiltSection } from "@/components/editor/inspector/tilt-section"

beforeEach(() => {
  store.tilt = { rx: 5, ry: 10, rz: 15 }
  store.scale = 120
  store.selectedSlot = null
  store.target = "all"
})

afterEach(() => vi.clearAllMocks())

describe("TiltSection", () => {
  it("renders the four control rows", () => {
    render(<TiltSection />)
    expect(screen.getByText("Rotate X")).toBeInTheDocument()
    expect(screen.getByText("Rotate Y")).toBeInTheDocument()
    expect(screen.getByText("Rotate Z")).toBeInTheDocument()
    expect(screen.getByText("Scale")).toBeInTheDocument()
  })

  it("maps Rotate X→tilt.ry, Rotate Y→tilt.rx, Rotate Z→tilt.rz, plus scale", () => {
    render(<TiltSection />)
    // ry = 10, rx = 5, rz = 15, scale = 120
    expect(screen.getByRole("slider", { name: "Rotate X" })).toHaveAttribute(
      "aria-valuenow",
      "10"
    )
    expect(screen.getByRole("slider", { name: "Rotate Y" })).toHaveAttribute(
      "aria-valuenow",
      "5"
    )
    expect(screen.getByRole("slider", { name: "Rotate Z" })).toHaveAttribute(
      "aria-valuenow",
      "15"
    )
    expect(screen.getByRole("slider", { name: "Scale" })).toHaveAttribute(
      "aria-valuenow",
      "120"
    )
  })

  it("commits a Rotate X edit into tilt.ry via applyStyle", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    const slider = screen.getByRole("slider", { name: "Rotate X" })
    slider.focus()
    // 10 → 20 via Shift+ArrowRight (+10)
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    const patch = store.applyStyle.mock.calls[
      store.applyStyle.mock.calls.length - 1
    ][0] as { tilt: Tilt }
    expect(patch.tilt).toEqual({ rx: 5, ry: 20, rz: 15 })
  })

  it("commits a scale edit via applyStyle", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    const slider = screen.getByRole("slider", { name: "Scale" })
    slider.focus()
    // Slider max is 150; End jumps to max.
    await user.keyboard("{End}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ scale: 150 })
  })

  it("clamps a scale edit to the slider max", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    const slider = screen.getByRole("slider", { name: "Scale" })
    slider.focus()
    await user.keyboard("{End}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ scale: 150 })
  })

  it("routes whole-canvas Z-rotation through applyStyle as a rotation patch", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    const slider = screen.getByRole("slider", { name: "Rotate Z" })
    slider.focus()
    // Controlled mock value stays at 15; Shift+Arrow nudges by 10.
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ rotation: 25 })
  })

  it("uses the selected slot's tilt, scale and rotation when a slot is active", () => {
    store.selectedSlot = {
      id: "slot-1",
      tilt: { rx: 1, ry: 2, rz: 3 },
      scale: 80,
      rotation: 42,
    }
    store.target = "slot"
    render(<TiltSection />)

    // Rotate X = ry, Rotate Y = rx, Rotate Z = slot rotation
    expect(screen.getByRole("slider", { name: "Rotate X" })).toHaveAttribute(
      "aria-valuenow",
      "2"
    )
    expect(screen.getByRole("slider", { name: "Rotate Y" })).toHaveAttribute(
      "aria-valuenow",
      "1"
    )
    expect(screen.getByRole("slider", { name: "Rotate Z" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    )
    expect(screen.getByRole("slider", { name: "Scale" })).toHaveAttribute(
      "aria-valuenow",
      "80"
    )
  })

  it("commits slot Z-rotation through applyStyle as a rotation patch", async () => {
    store.selectedSlot = {
      id: "slot-1",
      tilt: { rx: 1, ry: 2, rz: 3 },
      scale: 80,
      rotation: 42,
    }
    store.target = "slot"
    const user = userEvent.setup()
    render(<TiltSection />)

    const slider = screen.getByRole("slider", { name: "Rotate Z" })
    slider.focus()
    // Controlled mock value stays at 42; Shift+ArrowLeft nudges by −10.
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}")

    expect(store.applyStyle).toHaveBeenCalled()
    expect(
      store.applyStyle.mock.calls[store.applyStyle.mock.calls.length - 1][0]
    ).toEqual({ rotation: 32 })
  })
})
