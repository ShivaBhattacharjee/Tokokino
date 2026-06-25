import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `AnnotationToolbar` — the annotate-mode tool strip (brushes, shapes, color,
 * clear, exit). Routes through the editor store; color popover is stubbed.
 */
const editor = vi.hoisted(() => ({
  annotation: {
    mode: "pen",
    color: "#ff0000",
    lineStyle: "solid",
    blurEffect: "blur",
    strokeWidth: 4,
    opacity: 100,
  },
  setAnnotation: vi.fn(),
  clearAnnotations: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
  ANNOTATION_STROKES: [2, 4, 7, 11],
}))

vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { AnnotationToolbar } from "@/components/editor/annotation-toolbar"

const renderToolbar = (onExit = vi.fn()) => {
  render(
    <TooltipProvider>
      <AnnotationToolbar onExit={onExit} />
    </TooltipProvider>
  )
  return onExit
}

beforeEach(() => {
  editor.annotation = {
    mode: "pen",
    color: "#ff0000",
    lineStyle: "solid",
    blurEffect: "blur",
    strokeWidth: 4,
    opacity: 100,
  }
})
afterEach(() => vi.clearAllMocks())

describe("AnnotationToolbar", () => {
  it("renders the brush and shape tools", () => {
    renderToolbar()
    for (const label of [
      "Pen",
      "Highlighter",
      "Eraser",
      "Arrow",
      "Rectangle",
      "Ellipse",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("exits annotate mode", async () => {
    const user = userEvent.setup()
    const onExit = renderToolbar()
    await user.click(screen.getByRole("button", { name: "Exit annotate mode" }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it("selects a tool through setAnnotation", async () => {
    const user = userEvent.setup()
    renderToolbar()
    await user.click(screen.getByRole("button", { name: "Arrow" }))
    expect(editor.setAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "arrow" })
    )
  })

  it("clears all annotations", async () => {
    const user = userEvent.setup()
    renderToolbar()
    await user.click(
      screen.getByRole("button", { name: "Clear all annotations" })
    )
    expect(editor.clearAnnotations).toHaveBeenCalledOnce()
  })
})
