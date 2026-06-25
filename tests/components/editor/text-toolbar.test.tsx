import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * `TextToolbar` — floating formatting toolbar for a text layer: font size,
 * family, color, alignment, etc. Routes through the editor store.
 */
const editor = vi.hoisted(() => ({
  updateText: vi.fn(),
  deleteText: vi.fn(),
  duplicateText: vi.fn(),
  bringTextToFront: vi.fn(),
  sendTextToBack: vi.fn(),
  setSelectedTextId: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
  FONT_FAMILIES: [
    { id: "inter", label: "Inter", css: "Inter, sans-serif", category: "sans" },
  ],
}))

vi.mock("@/components/editor/color-picker-popover", () => ({
  ColorPickerPopover: ({ children }: { children: React.ReactNode }) => children,
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { TextToolbar } from "@/components/editor/text-toolbar"

const text = {
  id: "t1",
  content: "Hi",
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
}

function renderToolbar() {
  render(
    <TooltipProvider>
      <TextToolbar
        text={text}
        onDragHandlePointerDown={() => {}}
        onDragHandlePointerMove={() => {}}
        onDragHandlePointerUp={() => {}}
      />
    </TooltipProvider>
  )
}

afterEach(() => vi.clearAllMocks())

describe("TextToolbar", () => {
  it("renders the font-size and family controls", () => {
    renderToolbar()
    expect(
      screen.getByRole("button", { name: "Decrease font size" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Increase font size" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Font family" })
    ).toBeInTheDocument()
  })

  it("increases the font size via updateText", async () => {
    const user = userEvent.setup()
    renderToolbar()
    await user.click(screen.getByRole("button", { name: "Increase font size" }))
    expect(editor.updateText).toHaveBeenCalledWith("t1", expect.anything())
    const patch = editor.updateText.mock.calls[0][1] as { fontSize: number }
    expect(patch.fontSize).toBeGreaterThan(24)
  })

  it("decreases the font size via updateText", async () => {
    const user = userEvent.setup()
    renderToolbar()
    await user.click(screen.getByRole("button", { name: "Decrease font size" }))
    const patch = editor.updateText.mock.calls[0][1] as { fontSize: number }
    expect(patch.fontSize).toBeLessThan(24)
  })

  it("exposes a text color control", () => {
    renderToolbar()
    expect(
      screen.getByRole("button", { name: "Text color" })
    ).toBeInTheDocument()
  })
})
