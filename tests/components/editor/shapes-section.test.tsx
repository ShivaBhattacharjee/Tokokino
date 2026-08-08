import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

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
                    ![
                      "initial",
                      "animate",
                      "exit",
                      "transition",
                      "variants",
                      "layoutId",
                    ].includes(k)
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

const mocks = vi.hoisted(() => ({
  SHAPES: Array.from({ length: 14 }, (_, i) => ({
    id: `s${i}`,
    name: `Shape ${i}`,
    full: `full-${i}.png`,
    thumb: `thumb-${i}.png`,
    width: 100,
    height: 100,
  })),
  editor: {
    addAsset: vi.fn(() => "asset-1"),
    setSelectedAssetId: vi.fn(),
    setSelectedTextId: vi.fn(),
    setSelectedScreenshotSlotId: vi.fn(),
    setIsScreenshotSelected: vi.fn(),
    setActiveTool: vi.fn(),
  },
}))

vi.mock("@/lib/editor/presets", () => ({ SHAPE_LIBRARY: mocks.SHAPES }))
vi.mock("@/lib/editor/store", () => ({ useEditor: () => mocks.editor }))

const editor = mocks.editor

import { ShapesSection } from "@/components/editor/inspector/shapes-section"

/** Shape tiles are the only buttons titled "Add …"; the toggle is separate. */
const shapeTiles = () => screen.getAllByTitle(/^Add Shape/)

describe("ShapesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a preview grid, not the whole library, before expanding", () => {
    render(<ShapesSection />)
    expect(shapeTiles()).toHaveLength(8)
    expect(screen.getByTitle("Add Shape 0")).toBeInTheDocument()
    expect(screen.queryByTitle("Add Shape 8")).not.toBeInTheDocument()
  })

  it("offers a load-more toggle counting the shapes it hides", () => {
    render(<ShapesSection />)
    const toggle = screen.getByTitle("Show all 14 shapes")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("+6")).toBeInTheDocument()
  })

  it("reveals the rest of the library when the toggle is used", async () => {
    const user = userEvent.setup()
    render(<ShapesSection />)

    await user.click(screen.getByTitle("Show all 14 shapes"))

    expect(shapeTiles()).toHaveLength(14)
    expect(screen.getByTitle("Add Shape 13")).toBeInTheDocument()
    expect(screen.getByTitle("Show fewer shapes")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("collapses back to the preview grid", async () => {
    const user = userEvent.setup()
    render(<ShapesSection />)

    await user.click(screen.getByTitle("Show all 14 shapes"))
    await user.click(screen.getByTitle("Show fewer shapes"))

    expect(shapeTiles()).toHaveLength(8)
  })

  it("only mounts the capped scroller once expanded", async () => {
    const user = userEvent.setup()
    const { container } = render(<ShapesSection />)
    const wrap = container.querySelector("[class*='contain:layout_paint']")!

    expect(wrap.className).not.toContain("overflow-y-auto")
    await user.click(screen.getByTitle("Show all 14 shapes"))
    expect(wrap.className).toContain("overflow-y-auto")
  })

  it("drops a shape onto the canvas and selects it", async () => {
    const user = userEvent.setup()
    render(<ShapesSection />)

    await user.click(screen.getByTitle("Add Shape 2"))

    expect(editor.addAsset).toHaveBeenCalledWith("full-2.png")
    expect(editor.setSelectedAssetId).toHaveBeenCalledWith("asset-1")
    expect(editor.setIsScreenshotSelected).toHaveBeenCalledWith(false)
    expect(editor.setActiveTool).toHaveBeenCalledWith("pointer")
  })

  it("keeps the toggle when the panel scrolls in an ancestor (flat)", async () => {
    const user = userEvent.setup()
    render(<ShapesSection flat />)

    expect(shapeTiles()).toHaveLength(8)
    await user.click(screen.getByTitle("Show all 14 shapes"))
    expect(shapeTiles()).toHaveLength(14)
  })
})
