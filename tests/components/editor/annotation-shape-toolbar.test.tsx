import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * `AnnotationShapeToolbar` — per-shape controls (move/delete/duplicate, color,
 * line style, layer order). Branches on `shape.kind`. The editor store, color
 * popover and SVG previews are stubbed.
 */
const editor = vi.hoisted(() => ({
  updateAnnotationShape: vi.fn(),
  deleteAnnotationShape: vi.fn(),
  duplicateAnnotationShape: vi.fn(() => "new-id"),
  bringAnnotationShapeToFront: vi.fn(),
  sendAnnotationShapeToBack: vi.fn(),
  setSelectedAnnotationShapeId: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
}))

vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/annotation-shape/previews", () => ({
  LineStylePreview: () => <span data-testid="line-style-preview" />,
  RedactionTemplatePreview: () => <span data-testid="redaction-preview" />,
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { AnnotationShapeToolbar } from "@/components/editor/annotation-shape/toolbar"
import type { AnnotationShape } from "@/lib/editor/store"

const shape = (over: Partial<AnnotationShape>): AnnotationShape => ({
  id: "shape-1",
  kind: "rect",
  xPct: 10,
  yPct: 10,
  widthPct: 20,
  heightPct: 20,
  rotation: 0,
  color: "#ff0000",
  strokeWidth: 4,
  lineStyle: "solid",
  zIndex: 0,
  ...over,
})

function renderToolbar(s: AnnotationShape) {
  return render(
    <TooltipProvider>
      <AnnotationShapeToolbar
        shape={s}
        onDragPointerDown={() => {}}
        onDragPointerMove={() => {}}
        onDragPointerUp={() => {}}
      />
    </TooltipProvider>
  )
}

afterEach(() => vi.clearAllMocks())

describe("AnnotationShapeToolbar", () => {
  it("exposes a labeled toolbar for the shape kind", () => {
    renderToolbar(shape({ kind: "rect" }))
    expect(
      screen.getByRole("toolbar", { name: "rect annotation controls" })
    ).toBeInTheDocument()
  })

  it("deletes the shape and clears the selection", async () => {
    const user = userEvent.setup()
    renderToolbar(shape({ id: "shape-9" }))
    await user.click(screen.getByRole("button", { name: "Delete shape" }))
    expect(editor.deleteAnnotationShape).toHaveBeenCalledWith("shape-9")
    expect(editor.setSelectedAnnotationShapeId).toHaveBeenCalledWith(null)
  })

  it("duplicates a rect shape and selects the copy", async () => {
    const user = userEvent.setup()
    renderToolbar(shape({ id: "shape-9", kind: "rect" }))
    await user.click(screen.getByRole("button", { name: "Duplicate shape" }))
    expect(editor.duplicateAnnotationShape).toHaveBeenCalledWith("shape-9")
    expect(editor.setSelectedAnnotationShapeId).toHaveBeenCalledWith("new-id")
  })

  it("offers a color control for non-blur shapes", () => {
    renderToolbar(shape({ kind: "rect" }))
    expect(
      screen.getByRole("button", { name: "Shape color" })
    ).toBeInTheDocument()
  })

  it("hides the duplicate button for step shapes", () => {
    renderToolbar(shape({ kind: "step" }))
    expect(
      screen.queryByRole("button", { name: "Duplicate shape" })
    ).not.toBeInTheDocument()
  })

  it("shows redaction templates and no color control for blur shapes", () => {
    renderToolbar(shape({ kind: "blur" }))
    expect(screen.getAllByTestId("redaction-preview").length).toBeGreaterThan(0)
    expect(
      screen.queryByRole("button", { name: "Shape color" })
    ).not.toBeInTheDocument()
  })
})
