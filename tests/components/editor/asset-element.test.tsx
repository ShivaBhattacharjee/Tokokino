import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `AssetElementView` — a draggable/resizable image layer. Selection shows the
 * floating `AssetToolbar`. Store, floating-rect hook and ShimmerImage stubbed.
 */
const editor = vi.hoisted(() => ({
  selectedAssetId: null as string | null,
  setSelectedAssetId: vi.fn(),
  setSelectedTextId: vi.fn(),
  setSelectedAnnotationShapeId: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  bulkEditMode: false,
  bulkCanvasDragging: false,
  bulkViewportZoom: 1,
}))

vi.mock("@/lib/editor/store", () => ({
  useEditor: () => editor,
  assetFilterCss: () => "none",
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

vi.mock("@/components/ui/shimmer-image", () => ({
  ShimmerImage: ({ src, alt }: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} />
  ),
}))

import { TooltipProvider } from "@/components/ui/tooltip"
import { AssetElementView } from "@/components/editor/asset-element"

const makeAsset = () => ({
  id: "a1",
  src: "asset.png",
  xPct: 50,
  yPct: 50,
  widthPct: 30,
  heightPct: null,
  rotation: 0,
  zIndex: 1,
  opacity: 100,
  filter: "none" as const,
  blendMode: "normal" as const,
  hidden: false,
  flipX: false,
  flipY: false,
})

function renderAsset(previewMode = false) {
  return render(
    <TooltipProvider>
      <AssetElementView
        asset={makeAsset()}
        canvasRef={createRef<HTMLDivElement>()}
        previewMode={previewMode}
      />
    </TooltipProvider>
  )
}

beforeEach(() => {
  editor.selectedAssetId = null
})
afterEach(() => vi.clearAllMocks())

describe("AssetElementView", () => {
  it("renders the asset image with its data id", () => {
    const { container } = renderAsset()
    expect(
      container.querySelector('[data-editor-asset-id="a1"]')
    ).not.toBeNull()
    expect(container.querySelector("img")).toHaveAttribute("src", "asset.png")
  })

  it("shows no toolbar when not selected", () => {
    renderAsset()
    expect(
      screen.queryByRole("button", { name: "Replace asset" })
    ).not.toBeInTheDocument()
  })

  it("shows the asset toolbar when selected", () => {
    editor.selectedAssetId = "a1"
    renderAsset()
    expect(
      screen.getByRole("button", { name: "Replace asset" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Flip horizontal" })
    ).toBeInTheDocument()
  })

  it("hides the toolbar in preview mode even when selected", () => {
    editor.selectedAssetId = "a1"
    renderAsset(true)
    expect(
      screen.queryByRole("button", { name: "Replace asset" })
    ).not.toBeInTheDocument()
  })
})
