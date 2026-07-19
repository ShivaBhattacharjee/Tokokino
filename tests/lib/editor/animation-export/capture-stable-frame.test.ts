import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  captureLayeredAnimationFrame: vi.fn(),
  applyAnimationFrameAtTime: vi.fn(),
  measureBareStageDims: vi.fn(() => null),
}))

vi.mock("@/lib/editor/animation-export/webkit-layered-frame", () => ({
  captureLayeredAnimationFrame: mocks.captureLayeredAnimationFrame,
}))
vi.mock("@/lib/editor/apply-animation-frame", () => ({
  applyAnimationFrameAtTime: mocks.applyAnimationFrameAtTime,
  measureBareStageDims: mocks.measureBareStageDims,
}))
vi.mock("@/lib/editor/export", () => ({
  prepareAnimationCapture: vi.fn(),
  prepareFastAnimationCapture: vi.fn(),
}))

import { captureStableFrame } from "@/lib/editor/animation-export/capture"
import type { CloneVideoLayer } from "@/lib/editor/animation-export/video-layer"
import type { AnimationCapture } from "@/lib/editor/export"
import type { AspectState, CanvasState } from "@/lib/editor/state-types"

class FakeContext {
  fillStyle = ""
  drawImage() {}
  fillRect() {}
  clearRect() {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4).fill(255) }
  }
}

function makeFrame(width = 1080, height = 675): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

function makeCapture(): AnimationCapture & {
  captureFrame: ReturnType<typeof vi.fn>
} {
  return {
    node: document.createElement("div"),
    width: 1080,
    height: 675,
    needsPaint: false,
    captureFrame: vi.fn(async () => makeFrame()),
    cleanup: () => {},
  }
}

function makeVideoLayer(): CloneVideoLayer & {
  paint: ReturnType<typeof vi.fn>
} {
  return {
    paint: vi.fn(async () => {}),
    getFrame: vi.fn(async () => null),
    mediaElement: document.createElement("img"),
    sourceDurationMs: 7000,
    cleanup: () => {},
  }
}

const canvasState = { enhance: "vivid" } as CanvasState
const aspect: AspectState = { id: "auto", w: 0, h: 0 }

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => new FakeContext() as unknown as CanvasRenderingContext2D
  )
  // waitForPaint double-rAFs; jsdom may not provide rAF without visual mode.
  if (typeof globalThis.requestAnimationFrame === "undefined") {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.measureBareStageDims.mockReturnValue(null)
})

describe("captureStableFrame — layered WebKit path integration", () => {
  it("applies the keyframe, then prefers the layered capture when it lands", async () => {
    const capture = makeCapture()
    mocks.captureLayeredAnimationFrame.mockResolvedValue(makeFrame())

    const frame = await captureStableFrame(
      capture,
      canvasState,
      aspect,
      [],
      1500
    )

    expect(frame).toBeInstanceOf(HTMLCanvasElement)
    expect(frame.width).toBe(1080)
    expect(frame.height).toBe(675)
    expect(mocks.applyAnimationFrameAtTime).toHaveBeenCalledWith(
      expect.objectContaining({ canvasEl: capture.node, timeMs: 1500 })
    )
    expect(mocks.captureLayeredAnimationFrame).toHaveBeenCalledWith(
      capture,
      expect.objectContaining({ timelineMs: 1500, enhance: "vivid" })
    )
    // The keyframe must be on the clone before the layered passes rasterize it.
    expect(
      mocks.applyAnimationFrameAtTime.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.captureLayeredAnimationFrame.mock.invocationCallOrder[0]
    )
    // The plain single-pass capture must not run — its raster would flatten
    // the perspective the layered path exists to preserve.
    expect(capture.captureFrame).not.toHaveBeenCalled()
  })

  it("skips the per-frame <img> JPEG paint when the layered path draws the video", async () => {
    const capture = makeCapture()
    const videoLayer = makeVideoLayer()
    mocks.captureLayeredAnimationFrame.mockResolvedValue(makeFrame())

    await captureStableFrame(capture, canvasState, aspect, [], 500, videoLayer)

    expect(mocks.captureLayeredAnimationFrame).toHaveBeenCalledWith(
      capture,
      expect.objectContaining({ videoLayer })
    )
    expect(videoLayer.paint).not.toHaveBeenCalled()
  })

  it("paints the clone's <img> and runs the plain capture when layered declines", async () => {
    const capture = makeCapture()
    const videoLayer = makeVideoLayer()
    mocks.captureLayeredAnimationFrame.mockResolvedValue(null)

    const frame = await captureStableFrame(
      capture,
      canvasState,
      aspect,
      [],
      500,
      videoLayer
    )

    expect(frame).toBeInstanceOf(HTMLCanvasElement)
    expect(videoLayer.paint).toHaveBeenCalledWith(500)
    expect(capture.captureFrame).toHaveBeenCalled()
  })

  it("treats a layered-path crash as a decline, not an export failure", async () => {
    const capture = makeCapture()
    mocks.captureLayeredAnimationFrame.mockRejectedValue(
      new Error("projection failed")
    )

    const frame = await captureStableFrame(capture, canvasState, aspect, [], 0)

    expect(frame).toBeInstanceOf(HTMLCanvasElement)
    expect(capture.captureFrame).toHaveBeenCalled()
  })
})
