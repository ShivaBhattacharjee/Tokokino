import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `BulkBar` — bulk-edit arrange toolbar (grid/row/column/reset/add). Visible
 * only in bulk-edit mode and not while annotating. The arrange geometry, store
 * and toast are stubbed.
 */
const store = vi.hoisted(() => ({
  addCanvas: vi.fn(() => "c3"),
  bulkEditMode: true,
  activeTool: "pointer",
  canvases: [{ id: "c1" }, { id: "c2" }] as { id: string }[],
  aspect: { w: 16, h: 10 },
  setCanvasPositions: vi.fn(),
  requestBulkFitView: vi.fn(),
}))

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: unknown) => fn,
}))

vi.mock("sonner", () => ({ toast: vi.fn() }))

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(
              tag,
              Object.fromEntries(
                Object.entries(props).filter(
                  ([k]) =>
                    !["initial", "animate", "exit", "transition"].includes(k)
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

vi.mock("@/components/editor/floating-toolbar-parts/geometry", () => ({
  BASE_CANVAS_WIDTH: 800,
  computeArrangedPositions: vi.fn(() => ({ c1: { x: 0, y: 0 } })),
}))

vi.mock("@/lib/editor/store", () => ({
  MAX_CANVASES: 20,
  useEditor: () => ({
    addCanvas: store.addCanvas,
    bulkEditMode: store.bulkEditMode,
    activeTool: store.activeTool,
  }),
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      present: { canvases: store.canvases, aspect: store.aspect },
      aspect: store.aspect,
      setCanvasPositions: store.setCanvasPositions,
      requestBulkFitView: store.requestBulkFitView,
    }),
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { BulkBar } from "@/components/editor/floating-toolbar-parts/bulk-bar"

const renderBar = () =>
  render(
    <TooltipProvider>
      <BulkBar />
    </TooltipProvider>
  )

beforeEach(() => {
  store.bulkEditMode = true
  store.activeTool = "pointer"
  store.canvases = [{ id: "c1" }, { id: "c2" }]
})
afterEach(() => vi.clearAllMocks())

describe("BulkBar", () => {
  it("renders the arrange controls in bulk-edit mode", () => {
    renderBar()
    expect(screen.getByText("Add canvas")).toBeInTheDocument()
    // grid/row/column/reset/add = 5 buttons
    expect(screen.getAllByRole("button")).toHaveLength(5)
  })

  it("is hidden when not in bulk-edit mode", () => {
    store.bulkEditMode = false
    renderBar()
    expect(screen.queryByText("Add canvas")).not.toBeInTheDocument()
  })

  it("is hidden while annotating", () => {
    store.activeTool = "arrow"
    renderBar()
    expect(screen.queryByText("Add canvas")).not.toBeInTheDocument()
  })

  it("arranges in a grid and fits the view", async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getAllByRole("button")[0]) // grid
    expect(store.setCanvasPositions).toHaveBeenCalledOnce()
    expect(store.requestBulkFitView).toHaveBeenCalledOnce()
  })

  it("resets positions to origin", async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getAllByRole("button")[3]) // reset
    expect(store.setCanvasPositions).toHaveBeenCalledWith({
      c1: { x: 0, y: 0 },
      c2: { x: 0, y: 0 },
    })
  })

  it("adds a canvas", async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByText("Add canvas"))
    expect(store.addCanvas).toHaveBeenCalledOnce()
  })

  it("disables Add canvas at the cap", () => {
    store.canvases = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}` }))
    renderBar()
    expect(screen.getByText("Add canvas").closest("button")).toBeDisabled()
  })
})
