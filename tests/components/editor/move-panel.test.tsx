import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileMovePanel` — resolves the move target (text/image/annotation/slot/
 * main/group) into a labeled `PositionSwipeField` and activates the position
 * tool while mounted. Heavy position math + preview helpers are stubbed.
 */
type Editor = {
  selectedTextId: string | null
  texts: { id: string; xPct: number; yPct: number }[]
  selectedAssetId: string | null
  assets: { id: string; xPct: number; yPct: number }[]
  selectedAnnotationShapeId: string | null
  annotationShapes: { id: string; xPct: number; yPct: number }[]
  selectedScreenshotSlotId: string | null
  screenshotSlots: { id: string; xPct: number; yPct: number }[]
  frame: { id: string }
  tweet: unknown
  screenshot: string | null
  scale: number
  aspect: { w: number; h: number }
  screenshotPosition: string
  screenshotOffset: { x: number; y: number }
}

const blankEditor = (): Editor => ({
  selectedTextId: null,
  texts: [],
  selectedAssetId: null,
  assets: [],
  selectedAnnotationShapeId: null,
  annotationShapes: [],
  selectedScreenshotSlotId: null,
  screenshotSlots: [],
  frame: { id: "none" },
  tweet: null,
  screenshot: null,
  scale: 100,
  aspect: { w: 16, h: 10 },
  screenshotPosition: "center",
  screenshotOffset: { x: 0, y: 0 },
})

const harness = vi.hoisted(() => ({
  editor: null as Editor | null,
  setActiveTool: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => harness.editor,
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      setActiveTool: harness.setActiveTool,
      present: { activeCanvasId: "canvas-1" },
    }),
}))

vi.mock("@/components/editor/position-swipe-field", () => ({
  PositionSwipeField: (props: { ariaLabel: string; disabled?: boolean }) => (
    <div
      data-testid="swipe"
      aria-label={props.ariaLabel}
      data-disabled={String(Boolean(props.disabled))}
    />
  ),
}))

vi.mock("@/lib/editor/live-preview-vars", () => ({
  afterPositionPreviewCleared: vi.fn(),
  clearPositionPreviewVarsAfterPaint: vi.fn(),
  livePreviewRoots: () => [],
  setElementPositionPreview: vi.fn(),
  setMainScreenshotBarePreviewPx: vi.fn(),
  setMainScreenshotPositionPreview: vi.fn(),
}))

vi.mock("@/components/editor/mobile-controls/position-math", () => ({
  bareScreenshotPositionPct: () => ({ xPct: 50, yPct: 50 }),
  bareScreenshotTargetLeftTop: () => ({ left: 0, top: 0 }),
  clampPercent: (v: number) => v,
  mainScreenshotOffsetForPoint: () => ({ x: 0, y: 0 }),
  mainScreenshotPositionPct: () => ({ xPct: 50, yPct: 50 }),
  positionIdFromPercent: () => "center",
  resolveBareScreenshotPlacement: () => ({
    position: "center",
    offset: { x: 0, y: 0 },
  }),
  screenshotSlotGroupCenter: () => null,
}))

import { MobileMovePanel } from "@/components/editor/mobile-controls/move-panel"

beforeEach(() => {
  harness.editor = blankEditor()
})
afterEach(() => vi.clearAllMocks())

describe("MobileMovePanel", () => {
  it("activates the position tool while mounted", () => {
    render(<MobileMovePanel />)
    expect(harness.setActiveTool).toHaveBeenCalledWith("position")
  })

  it("labels the field for the main screenshot target", () => {
    harness.editor = { ...blankEditor(), screenshot: "shot.png" }
    render(<MobileMovePanel />)
    expect(screen.getByTestId("swipe")).toHaveAttribute(
      "aria-label",
      "Move screenshot"
    )
  })

  it("labels the field for a selected text", () => {
    harness.editor = {
      ...blankEditor(),
      selectedTextId: "t1",
      texts: [{ id: "t1", xPct: 10, yPct: 10 }],
    }
    render(<MobileMovePanel />)
    expect(screen.getByTestId("swipe")).toHaveAttribute(
      "aria-label",
      "Move text"
    )
  })

  it("labels a device frame target", () => {
    harness.editor = { ...blankEditor(), frame: { id: "iphone" } }
    render(<MobileMovePanel />)
    expect(screen.getByTestId("swipe")).toHaveAttribute(
      "aria-label",
      "Move device frame"
    )
  })

  it("disables the field when there is nothing to move", () => {
    render(<MobileMovePanel />)
    const swipe = screen.getByTestId("swipe")
    expect(swipe).toHaveAttribute("aria-label", "Move nothing")
    expect(swipe).toHaveAttribute("data-disabled", "true")
  })
})
