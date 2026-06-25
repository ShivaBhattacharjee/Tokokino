import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `AnnotationShapeElement` — a draggable/resizable annotation shape. Selection
 * shows the rotate handle + floating shape toolbar. Store, floating-rect hook
 * and the shape toolbar are stubbed.
 */
const editor = vi.hoisted(() => ({
  selectedAnnotationShapeId: null as string | null,
  setSelectedAnnotationShapeId: vi.fn(),
  setSelectedTextId: vi.fn(),
  setSelectedAssetId: vi.fn(),
  updateAnnotationShape: vi.fn(),
  deleteAnnotationShape: vi.fn(),
  bulkEditMode: false,
  bulkCanvasDragging: false,
  bulkViewportZoom: 1,
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
}))

vi.mock("@/hooks/use-floating-toolbar-rect", () => ({
  useFloatingToolbarRect: () => ({
    toolbarRect: { top: 100, bottom: 140, left: 50, width: 200, height: 40 },
    hideFloatingToolbar: false,
    shouldAnimatePositionMove: false,
    measureRect: vi.fn(),
    setToolbarRect: vi.fn(),
  }),
}))

vi.mock("@/components/editor/annotation-shape/toolbar", () => ({
  AnnotationShapeToolbar: () => <div data-testid="shape-toolbar" />,
}))

import { AnnotationShapeElement } from "@/components/editor/annotation-shape/element"
import type { AnnotationShape } from "@/lib/editor/store"

const makeShape = (over: Partial<AnnotationShape> = {}): AnnotationShape => ({
  id: "sh1",
  kind: "rect",
  xPct: 50,
  yPct: 50,
  widthPct: 20,
  heightPct: 20,
  rotation: 0,
  color: "#ff0000",
  strokeWidth: 4,
  lineStyle: "solid",
  zIndex: 0,
  ...over,
})

function renderShape(previewMode = false, over?: Partial<AnnotationShape>) {
  return render(
    <AnnotationShapeElement
      shape={makeShape(over)}
      canvasRef={createRef<HTMLDivElement>()}
      previewMode={previewMode}
    />
  )
}

beforeEach(() => {
  editor.selectedAnnotationShapeId = null
})
afterEach(() => vi.clearAllMocks())

describe("AnnotationShapeElement", () => {
  it("renders the shape with its data id", () => {
    const { container } = renderShape()
    expect(
      container.querySelector('[data-annotation-shape-id="sh1"]')
    ).not.toBeNull()
  })

  it("shows no toolbar or rotate handle when not selected", () => {
    renderShape()
    expect(screen.queryByTestId("shape-toolbar")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Rotate shape" })
    ).not.toBeInTheDocument()
  })

  it("shows the rotate handle and toolbar when selected", () => {
    editor.selectedAnnotationShapeId = "sh1"
    renderShape()
    expect(
      screen.getByRole("button", { name: "Rotate shape" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("shape-toolbar")).toBeInTheDocument()
  })

  it("hides chrome in preview mode even when selected", () => {
    editor.selectedAnnotationShapeId = "sh1"
    renderShape(true)
    expect(screen.queryByTestId("shape-toolbar")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Rotate shape" })
    ).not.toBeInTheDocument()
  })
})
