import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The ASCII glyph layer paints entirely through a data-URI SVG mask, and WebKit
 * reports such a subresource loaded before it has decoded — so the flatten pass
 * can rasterize a blank canvas. Since the flatten REPLACES the glyph DOM, taking
 * a blank raster deletes the ASCII treatment from every frame of the export.
 */

const rasterizeNodeToCanvas = vi.fn<() => Promise<HTMLCanvasElement>>()
const isRasterEssentiallyEmpty = vi.fn<() => boolean>()
const supportsObjectViewBox = vi.fn<() => boolean>()

vi.mock("@/lib/editor/export-raster", () => ({
  rasterizeNodeToCanvas: () => rasterizeNodeToCanvas(),
  canvasToBlob: async () => new Blob(),
  exportScaleStyle: () => ({}),
}))

vi.mock("@/lib/editor/export-settle", () => ({
  isRasterEssentiallyEmpty: () => isRasterEssentiallyEmpty(),
  settleDelayMs: () => 0,
}))

vi.mock("@/lib/editor/crop-utils", () => ({
  supportsObjectViewBox: () => supportsObjectViewBox(),
}))

vi.mock("@/lib/editor/export-embed", () => ({
  readBlobAsDataUrl: async () => "data:image/png;base64,AAAA",
  waitForImageElement: async () => undefined,
  embedCloneImages: async () => undefined,
  embedCloneBackgroundImages: async () => undefined,
}))

vi.mock("@/lib/editor/export-dom", () => ({
  exportElementLayoutSize: () => ({ width: 800, height: 600 }),
  filterExportHidden: () => true,
  findCanvasElement: () => null,
  getCanvasLayoutDims: () => null,
}))

const { flattenAnimationAsciiLayers } =
  await import("@/lib/editor/export-animation-capture")

function nodeWithGlyphTree() {
  const node = document.createElement("div")
  node.innerHTML = `<div data-export-ascii-glyphs="true"></div>`
  return node
}

const glyphTreeOf = (node: HTMLElement) =>
  node.querySelector('[data-export-ascii-glyphs="true"]')

describe("flattenAnimationAsciiLayers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rasterizeNodeToCanvas.mockResolvedValue(document.createElement("canvas"))
    supportsObjectViewBox.mockReturnValue(false)
  })

  it("flattens a glyph tree whose raster painted", async () => {
    isRasterEssentiallyEmpty.mockReturnValue(false)
    const node = nodeWithGlyphTree()
    await flattenAnimationAsciiLayers(node, 800, 1600)
    expect(rasterizeNodeToCanvas).toHaveBeenCalledTimes(1)
    expect(glyphTreeOf(node)).toBeNull()
    expect(node.querySelector("img")).not.toBeNull()
  })

  it("retries a blank raster and flattens the attempt that paints", async () => {
    isRasterEssentiallyEmpty
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false)
    const node = nodeWithGlyphTree()
    await flattenAnimationAsciiLayers(node, 800, 1600)
    expect(rasterizeNodeToCanvas).toHaveBeenCalledTimes(3)
    expect(node.querySelector("img")).not.toBeNull()
  })

  it("keeps the glyph DOM when every raster comes back blank", async () => {
    isRasterEssentiallyEmpty.mockReturnValue(true)
    const node = nodeWithGlyphTree()
    await flattenAnimationAsciiLayers(node, 800, 1600)
    // The layer still paints through the per-frame capture, which has its own
    // WebKit warm-up. An <img> here would be a blank hole in every frame.
    expect(glyphTreeOf(node)).not.toBeNull()
    expect(node.querySelector("img")).toBeNull()
  })

  it("does not spend WebKit's retry budget on Chromium", async () => {
    isRasterEssentiallyEmpty.mockReturnValue(true)
    supportsObjectViewBox.mockReturnValue(true)
    const node = nodeWithGlyphTree()
    await flattenAnimationAsciiLayers(node, 800, 1600)
    expect(rasterizeNodeToCanvas).toHaveBeenCalledTimes(1)
    expect(glyphTreeOf(node)).not.toBeNull()
  })
})
