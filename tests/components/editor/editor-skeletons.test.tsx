import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `editor-skeletons` — loading placeholders. EffectsSidebarSkeleton and
 * InspectorSkeleton take a className; CanvasSkeleton reads aspect + preview
 * mode from the store.
 */

const store = vi.hoisted(() => ({
  aspect: { id: "16-10", w: 16, h: 10 },
  isPreviewMode: false,
}))

vi.mock("@/lib/editor/store", () => ({
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      present: { aspect: store.aspect },
      isPreviewMode: store.isPreviewMode,
    }),
}))

import {
  CanvasSkeleton,
  EffectsSidebarSkeleton,
  InspectorSkeleton,
} from "@/components/editor/editor-skeletons"

beforeEach(() => {
  store.aspect = { id: "16-10", w: 16, h: 10 }
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
  it("reflects the active aspect ratio in the placeholder", () => {
    store.aspect = { id: "4-3", w: 4, h: 3 }
    const { container } = render(<CanvasSkeleton />)
    const placeholder = container.querySelector(
      '[style*="aspect-ratio"]'
    ) as HTMLElement
    expect(placeholder.style.aspectRatio).toBe("4 / 3")
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
