import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `TextElement` — a draggable/resizable text layer. Selection shows the
 * rotate/resize handles and the floating `TextToolbar`. Store, toolbar,
 * floating-rect hook and Lens are stubbed.
 */
const editor = vi.hoisted(() => ({
  selectedTextId: null as string | null,
  setSelectedTextId: vi.fn(),
  setSelectedAnnotationShapeId: vi.fn(),
  updateText: vi.fn(),
  deleteText: vi.fn(),
  canvasZoom: 1,
  screenshot: null,
  background: { type: "none", value: "" },
  bulkEditMode: false,
  bulkCanvasDragging: false,
  bulkViewportZoom: 1,
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
  pickContrastColorAtPosition: () => "#000000",
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

vi.mock("@/components/editor/text-toolbar", () => ({
  TextToolbar: () => <div data-testid="text-toolbar" />,
}))

vi.mock("@/components/ui/lens", () => ({
  Lens: ({ children }: { children: React.ReactNode }) => children,
}))

import { TextElementView } from "@/components/editor/text-element"

const makeText = () => ({
  id: "t1",
  content: "Hello world",
  xPct: 50,
  yPct: 50,
  rotation: 0,
  fontSize: 24,
  fontFamily: "Inter, sans-serif",
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: 0,
  color: "#111111",
  align: "left" as const,
  borderColor: null,
  borderWidth: 0,
  borderStyle: "solid" as const,
  zIndex: 1,
  widthPx: null,
  heightPx: null,
  autoColor: false,
  strokeColor: null,
  strokeWidth: 0,
  textShadow: null,
  opacity: 100,
  blendMode: "normal" as const,
  hidden: false,
})

function renderText(previewMode = false) {
  return render(
    <TextElementView
      text={makeText()}
      canvasRef={createRef<HTMLDivElement>()}
      previewMode={previewMode}
    />
  )
}

beforeEach(() => {
  editor.selectedTextId = null
})
afterEach(() => vi.clearAllMocks())

describe("TextElement", () => {
  it("renders the text content with its data id", () => {
    const { container } = renderText()
    expect(container.querySelector('[data-editor-text-id="t1"]')).not.toBeNull()
    expect(screen.getAllByText("Hello world").length).toBeGreaterThan(0)
  })

  it("shows no handles or toolbar when not selected", () => {
    renderText()
    expect(
      screen.queryByRole("button", { name: "Rotate text" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("text-toolbar")).not.toBeInTheDocument()
  })

  it("shows rotate/resize handles and the toolbar when selected", () => {
    editor.selectedTextId = "t1"
    renderText()
    expect(
      screen.getByRole("button", { name: "Rotate text" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Resize tl")).toBeInTheDocument()
    expect(screen.getByTestId("text-toolbar")).toBeInTheDocument()
  })

  it("hides handles and toolbar in preview mode even when selected", () => {
    editor.selectedTextId = "t1"
    renderText(true)
    expect(
      screen.queryByRole("button", { name: "Rotate text" })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("text-toolbar")).not.toBeInTheDocument()
  })
})
