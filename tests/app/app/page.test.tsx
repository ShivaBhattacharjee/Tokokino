import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Tests for `app/app/page.tsx` — the editor page shell (`EditorLayout` +
 * `ScreenshotsPage`). All the heavy editor children (Canvas, sidebars,
 * toolbars, the Zustand store and `motion`) are mocked so these tests exercise
 * only the page's own logic: preview-mode gating, the slideshow settings
 * panel, the delay/animation option buttons, the Esc keybinding and which
 * chrome is mounted in each mode.
 */

// ---------------------------------------------------------------------------
// Store mock — a single mutable state object that selectors read from.
// ---------------------------------------------------------------------------
const storeMock = vi.hoisted(() => {
  const setters = {
    setIsPreviewMode: vi.fn(),
    setIsPreviewAutoScroll: vi.fn(),
    setPreviewAutoScrollDelay: vi.fn(),
    setPreviewAnimation: vi.fn(),
  }
  const defaults = {
    isPreviewMode: false,
    isPreviewAutoScroll: false,
    previewAutoScrollDelay: 3000,
    previewAnimation: "slide" as "slide" | "fade" | "zoom" | "flip",
    present: { activeCanvasId: "canvas-1" },
    ...setters,
  }
  const holder = { current: { ...defaults } }
  return { holder, setters, defaults }
})

vi.mock("@/lib/editor/store", () => ({
  EditorProvider: ({ children }: { children: React.ReactNode }) => children,
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector(storeMock.holder.current),
}))

// ---------------------------------------------------------------------------
// `motion` mock — strip animation-only props, render plain DOM, and render
// AnimatePresence children synchronously so conditional content is testable.
// ---------------------------------------------------------------------------
vi.mock("motion/react", async () => {
  const React = await import("react")
  const ANIM_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileInView",
    "layout",
    "layoutId",
  ])
  const strip = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(props)) {
      if (!ANIM_PROPS.has(key)) out[key] = props[key]
    }
    return out
  }
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) => (props: Record<string, unknown>) =>
        React.createElement(tag, strip(props)),
    }
  )
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})

// ---------------------------------------------------------------------------
// Child-component mocks — lightweight stubs keyed by data-testid. Components
// that receive a `className` echo it so we can assert the responsive classes
// the page passes down.
// ---------------------------------------------------------------------------
function stub(testid: string) {
  return function Stub({ className }: { className?: string } = {}) {
    return <div data-testid={testid} className={className} />
  }
}

vi.mock("@/components/editor/canvas", () => ({ Canvas: stub("canvas") }))
vi.mock("@/components/editor/top-bar", () => ({ TopBar: stub("top-bar") }))
vi.mock("@/components/editor/effects-sidebar", () => ({
  EffectsSidebar: stub("effects-sidebar"),
}))
vi.mock("@/components/editor/ipad-sidebar", () => ({
  IpadSidebar: stub("ipad-sidebar"),
}))
vi.mock("@/components/editor/inspector", () => ({
  Inspector: stub("inspector"),
}))
vi.mock("@/components/editor/floating-toolbar", () => ({
  FloatingToolbar: stub("floating-toolbar"),
  BulkBar: stub("bulk-bar"),
}))
vi.mock("@/components/editor/mobile-controls", () => ({
  MobileControls: (props: {
    onOpenChange?: (v: boolean) => void
    floatingOpen?: boolean
    onFloatingOpenChange?: (v: boolean) => void
  }) => (
    <div
      data-testid="mobile-controls"
      data-floating-open={String(props.floatingOpen)}
    />
  ),
}))
vi.mock("@/components/editor/deferred-mount", () => ({
  DeferredMount: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("@/components/editor/error-boundary", () => ({
  EditorErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}))
vi.mock("@/components/editor/editor-skeletons", () => ({
  CanvasSkeleton: stub("canvas-skeleton"),
  EffectsSidebarSkeleton: stub("effects-sidebar-skeleton"),
  InspectorSkeleton: stub("inspector-skeleton"),
}))

import ScreenshotsPage from "@/app/app/page"

function setState(overrides: Partial<typeof storeMock.defaults>) {
  storeMock.holder.current = {
    ...storeMock.holder.current,
    ...overrides,
  }
}

beforeEach(() => {
  storeMock.holder.current = { ...storeMock.defaults }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("app/app/page — edit mode (not preview)", () => {
  it("mounts the full editor chrome", () => {
    render(<ScreenshotsPage />)

    expect(screen.getByTestId("top-bar")).toBeInTheDocument()
    expect(screen.getByTestId("canvas")).toBeInTheDocument()
    expect(screen.getByTestId("bulk-bar")).toBeInTheDocument()
    expect(screen.getByTestId("effects-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("ipad-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("inspector")).toBeInTheDocument()
    expect(screen.getByTestId("floating-toolbar")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-controls")).toBeInTheDocument()
  })

  it("does not render the preview slideshow controls", () => {
    render(<ScreenshotsPage />)

    expect(screen.queryByText("Exit Preview")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Start slideshow")).not.toBeInTheDocument()
  })

  it("passes responsive visibility classes to the sidebars", () => {
    render(<ScreenshotsPage />)

    expect(screen.getByTestId("effects-sidebar")).toHaveClass(
      "hidden",
      "xl:flex"
    )
    expect(screen.getByTestId("inspector")).toHaveClass("hidden", "xl:flex")
    expect(screen.getByTestId("ipad-sidebar")).toHaveClass("xl:hidden")
  })

  it("forwards floatingOpen=false to MobileControls by default", () => {
    render(<ScreenshotsPage />)

    expect(screen.getByTestId("mobile-controls")).toHaveAttribute(
      "data-floating-open",
      "false"
    )
  })
})

describe("app/app/page — preview mode", () => {
  beforeEach(() => setState({ isPreviewMode: true }))

  it("hides the editor chrome but keeps canvas + bulk bar", () => {
    render(<ScreenshotsPage />)

    expect(screen.queryByTestId("top-bar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("effects-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("ipad-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("inspector")).not.toBeInTheDocument()
    expect(screen.queryByTestId("floating-toolbar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mobile-controls")).not.toBeInTheDocument()

    expect(screen.getByTestId("canvas")).toBeInTheDocument()
    expect(screen.getByTestId("bulk-bar")).toBeInTheDocument()
  })

  it("renders the slideshow control pill and exit button", () => {
    render(<ScreenshotsPage />)

    expect(screen.getByTitle("Start slideshow")).toBeInTheDocument()
    expect(screen.getByTitle("Slideshow settings")).toBeInTheDocument()
    expect(screen.getByText("Exit Preview")).toBeInTheDocument()
  })

  it("shows a Stop title when auto-scroll is running", () => {
    setState({ isPreviewAutoScroll: true })
    render(<ScreenshotsPage />)

    expect(screen.getByTitle("Stop slideshow")).toBeInTheDocument()
    expect(screen.queryByTitle("Start slideshow")).not.toBeInTheDocument()
  })

  it("toggles auto-scroll when the play button is clicked", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    await user.click(screen.getByTitle("Start slideshow"))

    expect(storeMock.setters.setIsPreviewAutoScroll).toHaveBeenCalledWith(true)
  })

  it("toggles auto-scroll off from the running state", async () => {
    setState({ isPreviewAutoScroll: true })
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    await user.click(screen.getByTitle("Stop slideshow"))

    expect(storeMock.setters.setIsPreviewAutoScroll).toHaveBeenCalledWith(false)
  })

  it("exits preview mode and stops auto-scroll on Exit Preview", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    await user.click(screen.getByText("Exit Preview"))

    expect(storeMock.setters.setIsPreviewMode).toHaveBeenCalledWith(false)
    expect(storeMock.setters.setIsPreviewAutoScroll).toHaveBeenCalledWith(false)
  })
})

describe("app/app/page — slideshow settings panel", () => {
  beforeEach(() => setState({ isPreviewMode: true }))

  it("is collapsed until the settings button is toggled", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    expect(screen.queryByText("Slide duration")).not.toBeInTheDocument()

    await user.click(screen.getByTitle("Slideshow settings"))

    expect(screen.getByText("Slide duration")).toBeInTheDocument()
    expect(screen.getByText("Transition")).toBeInTheDocument()
  })

  it("renders all five delay options and four transition options", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)
    await user.click(screen.getByTitle("Slideshow settings"))

    for (const label of ["1s", "2s", "3s", "5s", "10s"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    for (const label of ["Slide", "Fade", "Zoom", "Flip"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("sets the slide duration when a delay option is clicked", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)
    await user.click(screen.getByTitle("Slideshow settings"))

    await user.click(screen.getByRole("button", { name: "5s" }))
    expect(storeMock.setters.setPreviewAutoScrollDelay).toHaveBeenCalledWith(
      5000
    )

    await user.click(screen.getByRole("button", { name: "10s" }))
    expect(storeMock.setters.setPreviewAutoScrollDelay).toHaveBeenCalledWith(
      10000
    )
  })

  it("highlights the currently selected delay option", async () => {
    setState({ previewAutoScrollDelay: 2000 })
    const user = userEvent.setup()
    render(<ScreenshotsPage />)
    await user.click(screen.getByTitle("Slideshow settings"))

    expect(screen.getByRole("button", { name: "2s" })).toHaveClass(
      "bg-foreground"
    )
    expect(screen.getByRole("button", { name: "3s" })).not.toHaveClass(
      "bg-foreground"
    )
  })

  it("sets the transition animation when an option is clicked", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)
    await user.click(screen.getByTitle("Slideshow settings"))

    await user.click(screen.getByRole("button", { name: "Zoom" }))
    expect(storeMock.setters.setPreviewAnimation).toHaveBeenCalledWith("zoom")

    await user.click(screen.getByRole("button", { name: "Flip" }))
    expect(storeMock.setters.setPreviewAnimation).toHaveBeenCalledWith("flip")
  })

  it("highlights the currently selected transition", async () => {
    setState({ previewAnimation: "fade" })
    const user = userEvent.setup()
    render(<ScreenshotsPage />)
    await user.click(screen.getByTitle("Slideshow settings"))

    expect(screen.getByRole("button", { name: "Fade" })).toHaveClass(
      "bg-foreground"
    )
    expect(screen.getByRole("button", { name: "Slide" })).not.toHaveClass(
      "bg-foreground"
    )
  })
})

describe("app/app/page — Escape keybinding", () => {
  it("exits preview mode when Escape is pressed in preview", async () => {
    setState({ isPreviewMode: true })
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    await user.keyboard("{Escape}")

    expect(storeMock.setters.setIsPreviewMode).toHaveBeenCalledWith(false)
    expect(storeMock.setters.setIsPreviewAutoScroll).toHaveBeenCalledWith(false)
  })

  it("ignores Escape when not in preview mode", async () => {
    const user = userEvent.setup()
    render(<ScreenshotsPage />)

    await user.keyboard("{Escape}")

    expect(storeMock.setters.setIsPreviewMode).not.toHaveBeenCalled()
  })
})
