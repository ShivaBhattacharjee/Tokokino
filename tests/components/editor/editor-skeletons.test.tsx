import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `editor-skeletons` — loading placeholders. EffectsSidebarSkeleton and
 * InspectorSkeleton take a className; CanvasSkeleton reads preview mode from
 * the store and shows the brand mark over an indeterminate progress bar.
 */

const store = vi.hoisted(() => ({
  isPreviewMode: false,
}))

vi.mock("@/lib/editor/store", () => ({
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({ isPreviewMode: store.isPreviewMode }),
}))

import {
  CanvasSkeleton,
  EffectsSidebarSkeleton,
  InspectorSkeleton,
} from "@/components/editor/editor-skeletons"

beforeEach(() => {
  store.isPreviewMode = false
})

afterEach(() => vi.clearAllMocks())

describe("EffectsSidebarSkeleton", () => {
  it("renders an aside and merges className", () => {
    const { container } = render(<EffectsSidebarSkeleton className="x-1" />)
    const aside = container.querySelector("aside")!
    expect(aside).not.toBeNull()
    expect(aside).toHaveClass("x-1")
  })
})

describe("InspectorSkeleton", () => {
  it("renders an aside and merges className", () => {
    const { container } = render(<InspectorSkeleton className="y-1" />)
    const aside = container.querySelector("aside")!
    expect(aside).not.toBeNull()
    expect(aside).toHaveClass("y-1")
  })
})

describe("CanvasSkeleton", () => {
  it("shows an indeterminate progress bar carrying no measured value", () => {
    const { container } = render(<CanvasSkeleton />)
    const bar = container.querySelector('[role="progressbar"]')!
    expect(bar).not.toBeNull()
    // Mounting reports no progress, so the bar must not imply a percentage.
    expect(bar.getAttribute("aria-valuenow")).toBeNull()
  })

  it("uses preview layout when preview mode is on", () => {
    store.isPreviewMode = true
    const { container } = render(<CanvasSkeleton />)
    const surface = container.querySelector(
      "[data-editor-canvas-surface]"
    ) as HTMLElement
    expect(surface).toHaveClass("items-center", "justify-center")
  })

  it("uses the editing border layout when not in preview", () => {
    const { container } = render(<CanvasSkeleton />)
    const surface = container.querySelector(
      "[data-editor-canvas-surface]"
    ) as HTMLElement
    expect(surface).toHaveClass("border-b")
  })
})
