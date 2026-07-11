import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `FloatingToolbar` — swaps between the default tool contents and the
 * annotation toolbar based on `useBulkBarState().isAnnotateMode`, and shows the
 * media pill only in default mode.
 */

const state = vi.hoisted(() => ({
  isAnnotateMode: false,
  setActiveTool: vi.fn(),
}))

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(
              tag,
              // drop animation-only props
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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => ({ setActiveTool: state.setActiveTool }),
}))

vi.mock("@/components/editor/floating-toolbar-parts/bulk-bar", () => ({
  useBulkBarState: () => ({ isAnnotateMode: state.isAnnotateMode }),
  BulkBar: () => <div data-testid="bulk-bar" />,
}))

vi.mock("@/components/editor/annotation-toolbar", () => ({
  AnnotationToolbar: ({ onExit }: { onExit: () => void }) => (
    <button data-testid="annotation-toolbar" onClick={onExit}>
      annotation
    </button>
  ),
}))

vi.mock(
  "@/components/editor/floating-toolbar-parts/default-toolbar-contents",
  () => ({
    DefaultToolbarContents: () => <div data-testid="default-contents" />,
  })
)

vi.mock(
  "@/components/editor/floating-toolbar-parts/screenshot-media-pill",
  () => ({
    ScreenshotMediaPill: () => <div data-testid="media-pill" />,
  })
)

// Renders null for non-video canvases in real use; stub it so the store mock
// here doesn't need the full useEditorStore surface it depends on.
vi.mock("@/components/editor/video-control-bar", () => ({
  VideoControlBar: () => null,
}))

import { FloatingToolbar } from "@/components/editor/floating-toolbar"

beforeEach(() => {
  state.isAnnotateMode = false
})

afterEach(() => vi.clearAllMocks())

describe("FloatingToolbar", () => {
  it("shows the default toolbar contents and media pill in default mode", () => {
    render(<FloatingToolbar />)
    expect(screen.getByTestId("default-contents")).toBeInTheDocument()
    expect(screen.getByTestId("media-pill")).toBeInTheDocument()
    expect(screen.queryByTestId("annotation-toolbar")).not.toBeInTheDocument()
  })

  it("shows the annotation toolbar and hides the media pill in annotate mode", () => {
    state.isAnnotateMode = true
    render(<FloatingToolbar />)
    expect(screen.getByTestId("annotation-toolbar")).toBeInTheDocument()
    expect(screen.queryByTestId("default-contents")).not.toBeInTheDocument()
    expect(screen.queryByTestId("media-pill")).not.toBeInTheDocument()
  })

  it("marks the toolbar container with the active mode", () => {
    state.isAnnotateMode = true
    const { container } = render(<FloatingToolbar />)
    expect(container.querySelector('[data-mode="annotate"]')).not.toBeNull()
  })
})
