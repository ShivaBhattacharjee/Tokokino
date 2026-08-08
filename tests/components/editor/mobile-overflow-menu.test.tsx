import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileOverflowMenu` — the mobile "More actions" dropdown. Routes file /
 * workspace actions to props + the store. History (undo/redo/reset) lives in
 * the tools section via MobileHistoryButton.
 */
const store = vi.hoisted(() => ({
  setIsPreviewMode: vi.fn(),
  addCanvas: vi.fn(() => "c2"),
  canvases: [{ id: "c1" }] as unknown[],
}))

vi.mock("@/lib/editor/store", () => ({
  MAX_CANVASES: 20,
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setIsPreviewMode: store.setIsPreviewMode,
      addCanvas: store.addCanvas,
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
  onOpenImageClick: vi.fn(),
  onOpenVideoClick: vi.fn(),
  onOpenProjectClick: vi.fn(),
  onTemplatesClick: vi.fn(),
  onFeedbackClick: vi.fn(),
}

async function openMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "More actions" }))
  return user
}

beforeEach(() => {
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

  it("does not expose Undo, Redo, or Reset", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    await openMenu()
    expect(
      screen.queryByRole("menuitem", { name: "Undo" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Redo" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Reset" })
    ).not.toBeInTheDocument()
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

  it("copies as PNG", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Copy as PNG" }))
    expect(baseProps.onCopyPng).toHaveBeenCalledOnce()
  })

  it("routes Templates to onTemplatesClick", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Templates" }))
    expect(baseProps.onTemplatesClick).toHaveBeenCalledOnce()
  })

  it("routes Send feedback to onFeedbackClick", async () => {
    render(<MobileOverflowMenu {...baseProps} />)
    const user = await openMenu()
    await user.click(screen.getByRole("menuitem", { name: "Send feedback" }))
    expect(baseProps.onFeedbackClick).toHaveBeenCalledOnce()
  })
})
