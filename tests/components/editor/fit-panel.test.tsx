import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileFitPanel` — object-fit + scale stepper for the active screenshot or
 * the selected slot. Routes to slot vs canvas setters and clamps scale 10–300.
 */
type Slot = {
  id: string
  src: string | null
  objectFit?: string
  scale?: number
}
type Canvas = {
  screenshot: string | null
  objectFit: string
  scale: number
  frame: { id: string }
  screenshotSlots: unknown[]
}

const store = vi.hoisted(() => {
  const canvas: Canvas = {
    screenshot: "shot.png",
    objectFit: "cover",
    scale: 100,
    frame: { id: "none" },
    screenshotSlots: [],
  }
  return {
    selectedSlot: null as Slot | null,
    canvas,
    setObjectFit: vi.fn(),
    setScale: vi.fn(),
    updateScreenshotSlot: vi.fn(),
  }
})

vi.mock("@/lib/editor/store", () => ({
  useSelectedScreenshotSlot: () => store.selectedSlot,
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector(store.canvas),
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setObjectFit: store.setObjectFit,
      setScale: store.setScale,
      updateScreenshotSlot: store.updateScreenshotSlot,
    }),
}))

import { MobileFitPanel } from "@/components/editor/mobile-controls/fit-panel"

beforeEach(() => {
  store.selectedSlot = null
  store.canvas = {
    screenshot: "shot.png",
    objectFit: "cover",
    scale: 100,
    frame: { id: "none" },
    screenshotSlots: [],
  }
})
afterEach(() => vi.clearAllMocks())

describe("MobileFitPanel", () => {
  it("renders the three fit options and the current scale", () => {
    render(<MobileFitPanel />)
    expect(screen.getByRole("button", { name: "cover" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "contain" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "fill" })).toBeInTheDocument()
    expect(screen.getByText("100%")).toBeInTheDocument()
  })

  it("highlights the active fit", () => {
    render(<MobileFitPanel />)
    expect(screen.getByRole("button", { name: "cover" })).toHaveClass(
      "border-primary/40"
    )
  })

  it("sets object-fit on the canvas when no slot is selected", async () => {
    const user = userEvent.setup()
    render(<MobileFitPanel />)
    await user.click(screen.getByRole("button", { name: "contain" }))
    expect(store.setObjectFit).toHaveBeenCalledWith("contain")
  })

  it("routes object-fit to the selected slot", async () => {
    store.selectedSlot = { id: "slot-1", src: "slot.png" }
    const user = userEvent.setup()
    render(<MobileFitPanel />)
    await user.click(screen.getByRole("button", { name: "fill" }))
    expect(store.updateScreenshotSlot).toHaveBeenCalledWith("slot-1", {
      objectFit: "fill",
    })
  })

  it("disables the fit options when there is no fit target", () => {
    store.canvas.screenshot = null
    render(<MobileFitPanel />)
    expect(screen.getByRole("button", { name: "cover" })).toBeDisabled()
  })

  it("steps scale up by 10 via the plus button", async () => {
    const user = userEvent.setup()
    render(<MobileFitPanel />)
    // buttons: cover, contain, fill, minus, reset(100%), plus
    const buttons = screen.getAllByRole("button")
    await user.click(buttons[buttons.length - 1]) // plus
    expect(store.setScale).toHaveBeenCalledWith(110)
  })

  it("resets scale to 100 via the percentage button", async () => {
    store.canvas.scale = 140
    const user = userEvent.setup()
    render(<MobileFitPanel />)
    await user.click(screen.getByRole("button", { name: "140%" }))
    expect(store.setScale).toHaveBeenCalledWith(100)
  })

  it("disables the minus button at the minimum scale", () => {
    store.canvas.scale = 10
    render(<MobileFitPanel />)
    const buttons = screen.getAllByRole("button")
    // minus is the 4th button (after the 3 fit options)
    expect(buttons[3]).toBeDisabled()
  })
})
