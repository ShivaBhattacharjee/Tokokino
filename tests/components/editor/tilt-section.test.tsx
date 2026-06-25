import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `TiltSection` — store-connected 3D tilt + scale controls. Note the axis
 * mapping: the "Rotate X" row drives `tilt.ry` and "Rotate Y" drives
 * `tilt.rx`. Edits route through `applyStyle`, except Z-rotation on the whole
 * canvas which goes through `setScreenshotRotation`.
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
    expect(screen.getByRole("button", { name: "10°" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "5°" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "15°" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "120%" })).toBeInTheDocument()
  })

  it("commits a Rotate X edit into tilt.ry via applyStyle", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    await user.click(screen.getByRole("button", { name: "10°" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "20{Enter}")

    const patch = store.applyStyle.mock.calls[0][0] as { tilt: Tilt }
    expect(patch.tilt).toEqual({ rx: 5, ry: 20, rz: 15 })
  })

  it("commits a scale edit via applyStyle", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    await user.click(screen.getByRole("button", { name: "120%" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "150{Enter}")

    expect(store.applyStyle.mock.calls[0][0]).toEqual({ scale: 150 })
  })

  it("clamps a scale edit to the 10–300 range", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    await user.click(screen.getByRole("button", { name: "120%" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "999{Enter}")

    expect(store.applyStyle.mock.calls[0][0]).toEqual({ scale: 300 })
  })

  it("routes whole-canvas Z-rotation through setScreenshotRotation", async () => {
    const user = userEvent.setup()
    render(<TiltSection />)

    await user.click(screen.getByRole("button", { name: "15°" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "30{Enter}")

    expect(store.setters.setScreenshotRotation).toHaveBeenCalledWith(30)
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

    expect(screen.getByRole("button", { name: "2°" })).toBeInTheDocument() // Rotate X = ry
    expect(screen.getByRole("button", { name: "1°" })).toBeInTheDocument() // Rotate Y = rx
    expect(screen.getByRole("button", { name: "42°" })).toBeInTheDocument() // Rotate Z = slot rotation
    expect(screen.getByRole("button", { name: "80%" })).toBeInTheDocument() // scale
  })

  it("commits slot Z-rotation through updateScreenshotSlot", async () => {
    store.selectedSlot = {
      id: "slot-1",
      tilt: { rx: 1, ry: 2, rz: 3 },
      scale: 80,
      rotation: 42,
    }
    store.target = "slot"
    const user = userEvent.setup()
    render(<TiltSection />)

    await user.click(screen.getByRole("button", { name: "42°" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "25{Enter}")

    expect(store.setters.updateScreenshotSlot).toHaveBeenCalledWith("slot-1", {
      rotation: 25,
    })
  })
})
