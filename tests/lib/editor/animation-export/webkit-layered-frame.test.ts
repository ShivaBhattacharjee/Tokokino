import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest"
import type * as FrameCanvasUtils from "@/lib/editor/animation-export/video-media/frame-canvas-utils"

const mocks = vi.hoisted(() => ({
  supportsObjectViewBox: vi.fn(),
  collectProjectedLayers: vi.fn(),
  captureProjectedElementTexture: vi.fn(),
  warpProjectedTexture: vi.fn(),
  paintFrameToLocalBox: vi.fn(),
  buildForegroundLayer: vi.fn(),
  buildFrameChromeLayer: vi.fn(),
  paintsAboveVideo: vi.fn(),
  applyExportStackVisibility: vi.fn(),
  queryForeground: vi.fn(),
  restoreVisibility: vi.fn(),
}))

vi.mock("@/lib/editor/crop-utils", () => ({
  supportsObjectViewBox: mocks.supportsObjectViewBox,
}))
vi.mock("@/lib/editor/animation-export/video-media/frame-geometry", () => ({
  collectProjectedLayers: mocks.collectProjectedLayers,
}))
vi.mock("@/lib/editor/animation-export/video-media/frame-renderer", () => ({
  captureProjectedElementTexture: mocks.captureProjectedElementTexture,
  warpProjectedTexture: mocks.warpProjectedTexture,
  paintFrameToLocalBox: mocks.paintFrameToLocalBox,
  buildForegroundLayer: mocks.buildForegroundLayer,
  buildFrameChromeLayer: mocks.buildFrameChromeLayer,
  paintsAboveVideo: mocks.paintsAboveVideo,
}))
vi.mock("@/lib/editor/animation-export/video-media/export-stack", () => ({
  applyExportStackVisibility: mocks.applyExportStackVisibility,
  queryForeground: mocks.queryForeground,
}))
// Real copyCanvas (exercises the shared-canvas detach), immediate sleep so the
// underlay retry loop doesn't slow the suite down.
vi.mock(
  "@/lib/editor/animation-export/video-media/frame-canvas-utils",
  async (importOriginal) => {
    const actual = await importOriginal<typeof FrameCanvasUtils>()
    return { ...actual, sleep: () => Promise.resolve() }
  }
)

import { captureLayeredAnimationFrame } from "@/lib/editor/animation-export/webkit-layered-frame"
import type { CloneVideoLayer } from "@/lib/editor/animation-export/video-layer"
import type { AnimationCapture } from "@/lib/editor/export"

/**
 * jsdom has no 2D canvas. This fake tracks a single "pixel" per canvas —
 * drawImage propagates the source's pixel, getImageData reports it — which is
 * exactly enough for copyCanvas and the settle check's raster comparison:
 * frames with equal pixels read as identical rasters, unequal as changed.
 */
type PixelCanvas = HTMLCanvasElement & { __pixel?: number }

class FakeContext {
  fillStyle = ""
  constructor(private canvas: PixelCanvas) {}
  drawImage(source: PixelCanvas) {
    this.canvas.__pixel = source.__pixel ?? 0
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    return {
      data: new Uint8ClampedArray(w * h * 4).fill(this.canvas.__pixel ?? 0),
    }
  }
  clearRect() {}
  fillRect() {}
}

function makeFrame(pixel: number, width = 1080, height = 675): PixelCanvas {
  const canvas = document.createElement("canvas") as PixelCanvas
  canvas.width = width
  canvas.height = height
  canvas.__pixel = pixel
  return canvas
}

function makeNode(): HTMLElement {
  const node = document.createElement("div")
  const scope = document.createElement("div")
  scope.setAttribute("data-editor-shadow-preview-scope", "canvas")
  node.appendChild(scope)
  node.getBoundingClientRect = () =>
    ({ width: 1000, height: 625, top: 0, left: 0 }) as DOMRect
  return node
}

/**
 * `pixels[i]` is the raster the i-th captureFrame returns (last repeats).
 * Consecutive equal pixels let the underlay settle check accept.
 */
function makeCapture(
  pixels: number[],
  size: { width: number; height: number } = { width: 1080, height: 675 }
): AnimationCapture & { captureFrame: Mock<AnimationCapture["captureFrame"]> } {
  let call = 0
  return {
    node: makeNode(),
    width: size.width,
    height: size.height,
    needsPaint: false,
    captureFrame: vi.fn(async () => {
      const pixel = pixels[Math.min(call++, pixels.length - 1)]
      return makeFrame(pixel, size.width, size.height)
    }),
    cleanup: () => {},
  }
}

const shellLayer = () => {
  const el = document.createElement("div")
  return { el, carrier: el, quad: { localW: 800, localH: 500 } }
}

function makeTexture(pixel: number, mediaBox: object | null = null) {
  return {
    texture: makeFrame(pixel, 800, 500),
    pad: 0,
    boxW: 800,
    boxH: 500,
    mediaBox,
  }
}

const OPTS = { timelineMs: 0 }

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: PixelCanvas) {
      return new FakeContext(this) as unknown as CanvasRenderingContext2D
    }
  )
  mocks.supportsObjectViewBox.mockReturnValue(false)
  mocks.queryForeground.mockReturnValue([])
  mocks.applyExportStackVisibility.mockReturnValue(mocks.restoreVisibility)
  mocks.collectProjectedLayers.mockReturnValue([shellLayer()])
  mocks.captureProjectedElementTexture.mockResolvedValue(makeTexture(77))
  mocks.warpProjectedTexture.mockReturnValue(makeFrame(88))
  mocks.paintFrameToLocalBox.mockReturnValue(makeFrame(99))
  mocks.buildForegroundLayer.mockResolvedValue(null)
  mocks.buildFrameChromeLayer.mockResolvedValue(null)
  mocks.paintsAboveVideo.mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const mock of Object.values(mocks)) mock.mockReset()
})

describe("captureLayeredAnimationFrame — gating", () => {
  it("declines on engines whose foreignObject raster keeps perspective", async () => {
    mocks.supportsObjectViewBox.mockReturnValue(true)
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.collectProjectedLayers).not.toHaveBeenCalled()
    expect(capture.captureFrame).not.toHaveBeenCalled()
  })

  it("collects flat quads too, so zero-tilt frames stay on this pipeline", async () => {
    const capture = makeCapture([10, 10])

    await captureLayeredAnimationFrame(capture, OPTS)
    expect(mocks.collectProjectedLayers).toHaveBeenCalledWith(capture.node, {
      includeFlat: true,
    })
  })

  it("declines when no transformed shell exists", async () => {
    mocks.collectProjectedLayers.mockReturnValue([])
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.applyExportStackVisibility).not.toHaveBeenCalled()
  })

  it("declines when every transformed element is foreground (slots only)", async () => {
    const slot = document.createElement("div")
    const bent = document.createElement("div")
    slot.appendChild(bent)
    mocks.queryForeground.mockReturnValue([slot])
    mocks.collectProjectedLayers.mockReturnValue([
      { el: bent, carrier: bent, quad: { localW: 100, localH: 100 } },
    ])
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.applyExportStackVisibility).not.toHaveBeenCalled()
    expect(capture.captureFrame).not.toHaveBeenCalled()
  })

  it("declines when a transformed wrapper contains the backdrop", async () => {
    // Caching such a wrapper's texture would freeze the animated background
    // it smuggles in — the key only tracks scope/shell state.
    const layer = shellLayer()
    const backdrop = document.createElement("div")
    backdrop.setAttribute("data-export-stack", "underlay")
    layer.el.appendChild(backdrop)
    mocks.collectProjectedLayers.mockReturnValue([layer])
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.applyExportStackVisibility).not.toHaveBeenCalled()
  })
})

describe("captureLayeredAnimationFrame — composition", () => {
  it("hides every bent element for the underlay, then textures and warps the shell", async () => {
    const layer = shellLayer()
    mocks.collectProjectedLayers.mockReturnValue([layer])
    const capture = makeCapture([10, 10])

    const frame = await captureLayeredAnimationFrame(capture, OPTS)

    expect(frame).not.toBeNull()
    expect(mocks.applyExportStackVisibility).toHaveBeenCalledWith(
      capture.node,
      "underlay",
      { alsoHide: [layer.el] }
    )
    expect(mocks.restoreVisibility).toHaveBeenCalled()
    expect(mocks.captureProjectedElementTexture).toHaveBeenCalledTimes(1)
    expect(mocks.captureProjectedElementTexture.mock.calls[0][1]).toBe(layer)
    // No video layer → nothing to hide inside the texture.
    expect(mocks.captureProjectedElementTexture.mock.calls[0][4]).toBeNull()
    expect(mocks.warpProjectedTexture.mock.calls[0][1]).toBe(layer.quad)
    expect(mocks.buildFrameChromeLayer.mock.calls[0][1]).toBe(layer.el)
  })

  it("falls back entirely when the shell texture fails to capture", async () => {
    // A media-less frame is worse than one flattened frame from the plain path.
    mocks.captureProjectedElementTexture.mockResolvedValue(null)
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.restoreVisibility).toHaveBeenCalled()
  })

  it("falls back entirely when the warp fails", async () => {
    mocks.warpProjectedTexture.mockReturnValue(null)
    const capture = makeCapture([10, 10])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
  })

  it("restores visibility and declines when every underlay capture throws", async () => {
    const capture = makeCapture([10, 10])
    capture.captureFrame.mockRejectedValue(new Error("raster failed"))

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.toBeNull()
    expect(mocks.restoreVisibility).toHaveBeenCalled()

    // The failure must not poison the cache: a working capture recovers.
    capture.captureFrame.mockImplementation(async () => makeFrame(10))
    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.not.toBeNull()
  })

  it("splits the foreground around the shell by stacking order", async () => {
    const behind = document.createElement("div")
    const above = document.createElement("div")
    mocks.queryForeground.mockReturnValue([behind, above])
    mocks.paintsAboveVideo.mockImplementation((el: HTMLElement) => el === above)
    mocks.buildForegroundLayer.mockResolvedValue(makeFrame(50))
    const capture = makeCapture([10, 10])

    await captureLayeredAnimationFrame(capture, OPTS)

    expect(mocks.buildForegroundLayer).toHaveBeenCalledTimes(2)
    expect(mocks.buildForegroundLayer.mock.calls[0][1]).toEqual([behind])
    expect(mocks.buildForegroundLayer.mock.calls[1][1]).toEqual([above])
    // behind-media pass → projected shell → above-media pass
    const [belowOrder, aboveOrder] =
      mocks.buildForegroundLayer.mock.invocationCallOrder
    const [shellOrder] = mocks.warpProjectedTexture.mock.invocationCallOrder
    expect(belowOrder).toBeLessThan(shellOrder)
    expect(shellOrder).toBeLessThan(aboveOrder)
  })
})

describe("captureLayeredAnimationFrame — video pixels", () => {
  function makeVideoLayer(layerEl: HTMLElement) {
    const mediaElement = document.createElement("img")
    layerEl.appendChild(mediaElement)
    return {
      paint: vi.fn(),
      getFrame: vi.fn(async () => ({ width: 1920, height: 1080 })),
      mediaElement,
      sourceDurationMs: 7000,
      cleanup: () => {},
    } as unknown as CloneVideoLayer & { getFrame: ReturnType<typeof vi.fn> }
  }

  it("hides the video img from the texture and draws decoded frames instead", async () => {
    const layer = shellLayer()
    mocks.collectProjectedLayers.mockReturnValue([layer])
    mocks.captureProjectedElementTexture.mockResolvedValue(
      makeTexture(77, { x: 10, y: 10, w: 780, h: 480 })
    )
    const videoLayer = makeVideoLayer(layer.el)
    const capture = makeCapture([10, 10])

    const frame = await captureLayeredAnimationFrame(capture, {
      timelineMs: 1234,
      videoLayer,
      enhance: "vivid",
    })

    expect(frame).not.toBeNull()
    // The texture capture must exclude the stale <img> pixels…
    expect(mocks.captureProjectedElementTexture.mock.calls[0][4]).toBe(
      videoLayer.mediaElement
    )
    // …and this frame's pixels come from the decoder, not the DOM.
    expect(videoLayer.getFrame).toHaveBeenCalledWith(1234)
    expect(mocks.paintFrameToLocalBox).toHaveBeenCalledTimes(1)
    const paintArgs = mocks.paintFrameToLocalBox.mock.calls[0]
    expect(paintArgs[3]).toBe(videoLayer.mediaElement)
    expect(paintArgs[4]).toBe(1920)
    expect(paintArgs[5]).toBe(1080)
    expect(paintArgs[7]).toMatchObject({ enhance: "vivid" })
  })

  it("re-warps the cached texture with fresh video pixels on later frames", async () => {
    const layer = shellLayer()
    mocks.collectProjectedLayers.mockReturnValue([layer])
    mocks.captureProjectedElementTexture.mockResolvedValue(
      makeTexture(77, { x: 0, y: 0, w: 800, h: 500 })
    )
    const videoLayer = makeVideoLayer(layer.el)
    const capture = makeCapture([10, 10])

    await captureLayeredAnimationFrame(capture, { timelineMs: 0, videoLayer })
    await captureLayeredAnimationFrame(capture, { timelineMs: 33, videoLayer })
    await captureLayeredAnimationFrame(capture, { timelineMs: 66, videoLayer })

    // One expensive texture capture, three cheap warps with per-frame pixels.
    expect(mocks.captureProjectedElementTexture).toHaveBeenCalledTimes(1)
    expect(mocks.warpProjectedTexture).toHaveBeenCalledTimes(3)
    expect(videoLayer.getFrame).toHaveBeenCalledTimes(3)
  })
})

describe("captureLayeredAnimationFrame — caches", () => {
  it("recaptures the underlay until two consecutive rasters agree", async () => {
    // First raster misses the async-decoded background image; the second has
    // it. Agreement between captures 2 and 3 accepts the complete raster —
    // an alpha heuristic can't see a missing layer above an opaque base.
    const capture = makeCapture([1, 60, 60])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.not.toBeNull()
    expect(capture.captureFrame).toHaveBeenCalledTimes(3)
  })

  it("gives up settling after the attempt budget and uses the last raster", async () => {
    const capture = makeCapture([10, 60, 110, 160, 210, 10, 60, 110])

    await expect(
      captureLayeredAnimationFrame(capture, OPTS)
    ).resolves.not.toBeNull()
    expect(capture.captureFrame).toHaveBeenCalledTimes(8)
  })

  it("reuses the cached underlay while backdrop vars are unchanged", async () => {
    const capture = makeCapture([10, 10])

    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    await captureLayeredAnimationFrame(capture, OPTS)
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)
  })

  it("ignores shell-only vars but recaptures when backdrop vars change", async () => {
    const capture = makeCapture([10, 10])
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    // Tilt/zoom/position/inner-lighting only move the hidden shell — cache hit.
    capture.node.style.setProperty("--canvas-ts-rx", "12deg")
    capture.node.style.setProperty("--editor-main-position-x", "40%")
    capture.node.style.setProperty("--bd-light-op-in", "0.5")
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    // Canvas radius clips the backdrop — new key, new capture.
    capture.node.style.setProperty("--canvas-bd-radius", "24px")
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(4)
  })

  it("holds the underlay across an animated crop", async () => {
    // Every crop var is recomputed per frame, the fit-correction ones included.
    // If any leaks into the key the underlay rebuilds on every frame of a crop
    // animation — the exact cost this cache exists to avoid.
    const capture = makeCapture([10, 10])
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    for (const [prop, value] of [
      ["--crop-view-box", "0 0 0.5 0.5"],
      ["--crop-w", "50%"],
      ["--crop-h", "50%"],
      ["--crop-left", "10%"],
      ["--crop-top", "10%"],
      ["--crop-shell-w", "640px"],
      ["--crop-shell-h", "360px"],
      ["--crop-fit-sx", "1.25"],
      ["--crop-fit-sy", "1.25"],
      ["--crop-fit-origin", "25% 40%"],
    ]) {
      capture.node.style.setProperty(prop, value)
      await captureLayeredAnimationFrame(capture, OPTS)
      expect(capture.captureFrame).toHaveBeenCalledTimes(2)
    }
  })

  it("recaptures the shell texture when its scope vars change", async () => {
    const capture = makeCapture([10, 10])
    const scope = capture.node.querySelector<HTMLElement>(
      '[data-editor-shadow-preview-scope="canvas"]'
    )

    await captureLayeredAnimationFrame(capture, OPTS)
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(mocks.captureProjectedElementTexture).toHaveBeenCalledTimes(1)

    // Animated shadow lands on the scope element → the texture must refresh.
    scope?.style.setProperty("--editor-shadow-preview", "0 0 10px red")
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(mocks.captureProjectedElementTexture).toHaveBeenCalledTimes(2)
  })

  it("bounds the underlay cache by bytes and re-captures evicted states", async () => {
    // Two 4000×4000 underlays (~64 MB each) exceed the 96 MB budget, so the
    // second evicts the first; revisiting the first key must recapture.
    const capture = makeCapture([10, 10], { width: 4000, height: 4000 })

    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    capture.node.style.setProperty("--canvas-bd-radius", "8px")
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(4)

    capture.node.style.removeProperty("--canvas-bd-radius")
    await captureLayeredAnimationFrame(capture, OPTS)
    expect(capture.captureFrame).toHaveBeenCalledTimes(6)
  })
})
