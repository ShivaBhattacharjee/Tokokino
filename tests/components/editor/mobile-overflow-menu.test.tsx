import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileOverflowMenu` — the mobile "More actions" dropdown. Routes file /
 * history / workspace actions to props + the store.
 */
const store = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
  reset: vi.fn(),
  setIsPreviewMode: vi.fn(),
  addCanvas: vi.fn(() => "c2"),
  past: [] as unknown[],
  future: [] as unknown[],
  canvases: [{ id: "c1" }] as unknown[],
}))

vi.mock("@/lib/editor/store", () => ({
  MAX_CANVASES: 20,
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      undo: store.undo,
      redo: store.redo,
      reset: store.reset,
      setIsPreviewMode: store.setIsPreviewMode,
      addCanvas: store.addCanvas,
      past: store.past,
      future: store.future,
      present: { canvases: store.canvases },
    }),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }))

import { MobileOverflowMenu } from "@/components/editor/top-bar/mobile-overflow-menu"

const baseProps = {
  bulkEditMode: false,
  onBulkEditClick: vi.fn(),
  onSaveClick: vi.fn(),
  onShareClick: vi.fn(),
  onCopyPng: vi.fn().mockResolvedValue(undefined),
  isCopyingPng: false,
  isPreparingShare: false,
  onNewClick: vi.fn(),
  onOpenClick: vi.fn(),
  onOpenProjectClick: vi.fn(),
}

async function openMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "More actions" }))
  return user
}

beforeEach(() => {
  store.past = []
  store.future = []
  store.canvases = [{ id: "c1" }]
})
afterEach(() => vi.clearAllMocks())

describe("MobileOverflowMenu", () => {
  it("routes New project to onNewClick", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "New project" }))
    expect(baseProps.onNewClick).toHaveBeenCalledOnce()
  })

  it("disables Undo/Redo without history", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Undo" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(screen.getByRole("menuitem", { name: "Redo" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("undoes when history exists", async () => {
    store.past = [{}]
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Undo" }))
    expect(store.undo).toHaveBeenCalledOnce()
  })

  it("enters preview mode", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Preview" }))
    expect(store.setIsPreviewMode).toHaveBeenCalledWith(true)
  })

  it("shows a bulk-edit label that reflects mode", async () => {
    render(<MobileOverflowMenu {...baseProps} bulkEditMode />)
    await openMenu()
    expect(
      screen.getByRole("menuitem", { name: "Exit bulk edit" })
    ).toBeInTheDocument()
  })

  it("disables Add canvas at the canvas cap", async () => {
    store.canvases = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}` }))
    render(<MobileOverflowMenu {...baseProps} />)
    await openMenu()
    expect(
      screen.getByRole("menuitem", { name: "Add canvas" })
    ).toHaveAttribute("aria-disabled", "true")
  })

  it("opens a confirm dialog for Reset and resets on confirm", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Reset" }))
    expect(screen.getByText("Reset to defaults?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(store.reset).toHaveBeenCalledOnce()
  })

  it("copies as PNG", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Copy as PNG" }))
    expect(baseProps.onCopyPng).toHaveBeenCalledOnce()
  })
})
