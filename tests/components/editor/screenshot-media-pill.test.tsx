import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `ScreenshotMediaPill` — floating toolbar pill: undo/redo, add screenshot slot,
 * image fit, and a scale stepper. Routes through the editor store.
 */
type Editor = {
  addScreenshotSlot: ReturnType<typeof vi.fn>
  screenshotSlots: { id: string; src?: string }[]
  updateScreenshotSlot: ReturnType<typeof vi.fn>
  setSelectedScreenshotSlotId: ReturnType<typeof vi.fn>
  setSelectedTextId: ReturnType<typeof vi.fn>
  setSelectedAssetId: ReturnType<typeof vi.fn>
  setSelectedAnnotationShapeId: ReturnType<typeof vi.fn>
  setIsScreenshotSelected: ReturnType<typeof vi.fn>
  setActiveTool: ReturnType<typeof vi.fn>
  screenshot: string | null
  tweet: unknown
  objectFit: string
  setObjectFit: ReturnType<typeof vi.fn>
  frame: { id: string }
  scale: number
  setScale: ReturnType<typeof vi.fn>
}

const h = vi.hoisted(() => ({
  presetTab: "single",
  past: [] as unknown[],
  future: [] as unknown[],
  selectedScreenshotSlotId: null as string | null,
  undo: vi.fn(),
  redo: vi.fn(),
  editor: null as Editor | null,
}))

const makeEditor = (over: Partial<Editor> = {}): Editor => ({
  addScreenshotSlot: vi.fn(() => "slot-new"),
  screenshotSlots: [],
  updateScreenshotSlot: vi.fn(),
  setSelectedScreenshotSlotId: vi.fn(),
  setSelectedTextId: vi.fn(),
  setSelectedAssetId: vi.fn(),
  setSelectedAnnotationShapeId: vi.fn(),
  setIsScreenshotSelected: vi.fn(),
  setActiveTool: vi.fn(),
  screenshot: "shot.png",
  tweet: null,
  objectFit: "cover",
  setObjectFit: vi.fn(),
  frame: { id: "none" },
  scale: 100,
  setScale: vi.fn(),
  ...over,
})

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

vi.mock("@/lib/editor/store", () => ({
  MAX_SCREENSHOT_SLOTS: 3,
  useEditor: () => h.editor,
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      presetTab: h.presetTab,
      undo: h.undo,
      redo: h.redo,
      past: h.past,
      future: h.future,
      selectedScreenshotSlotId: h.selectedScreenshotSlotId,
    }),
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { ScreenshotMediaPill } from "@/components/editor/floating-toolbar-parts/screenshot-media-pill"

const renderPill = () =>
  render(
    <TooltipProvider>
      <ScreenshotMediaPill />
    </TooltipProvider>
  )

beforeEach(() => {
  h.presetTab = "single"
  h.past = []
  h.future = []
  h.selectedScreenshotSlotId = null
  h.editor = makeEditor()
})
afterEach(() => vi.clearAllMocks())

describe("ScreenshotMediaPill", () => {
  it("adds a screenshot slot and selects it", async () => {
    const user = userEvent.setup()
    renderPill()
    await user.click(screen.getByRole("button", { name: "Add screenshot box" }))
    expect(h.editor!.addScreenshotSlot).toHaveBeenCalledOnce()
    expect(h.editor!.setSelectedScreenshotSlotId).toHaveBeenCalledWith(
      "slot-new"
    )
  })

  it("disables Add slot in multi preset mode", () => {
    h.presetTab = "multi"
    renderPill()
    expect(
      screen.getByRole("button", { name: "Add screenshot box" })
    ).toBeDisabled()
  })

  it("disables Add slot at the slot cap", () => {
    h.editor = makeEditor({
      screenshotSlots: [{ id: "a" }, { id: "b" }, { id: "c" }],
    })
    renderPill()
    expect(
      screen.getByRole("button", { name: "Add screenshot box" })
    ).toBeDisabled()
  })

  it("disables undo/redo without history", () => {
    renderPill()
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
  })

  it("undoes when history exists", async () => {
    h.past = [{}]
    const user = userEvent.setup()
    renderPill()
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(h.undo).toHaveBeenCalledOnce()
  })

  it("steps the scale up and down and resets", async () => {
    const user = userEvent.setup()
    renderPill()
    await user.click(screen.getByRole("button", { name: "Zoom in" }))
    expect(h.editor!.setScale).toHaveBeenCalledWith(110)

    await user.click(screen.getByRole("button", { name: "Zoom out" }))
    expect(h.editor!.setScale).toHaveBeenCalledWith(90)

    await user.click(screen.getByRole("button", { name: "100%" }))
    expect(h.editor!.setScale).toHaveBeenCalledWith(100)
  })

  it("disables the image-fit control with no screenshot", () => {
    h.editor = makeEditor({ screenshot: null })
    renderPill()
    expect(screen.getByRole("button", { name: "Image fit" })).toBeDisabled()
  })
})
