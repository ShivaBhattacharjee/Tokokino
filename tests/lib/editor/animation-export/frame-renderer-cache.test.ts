import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as FrameGeometry from "@/lib/editor/animation-export/video-media/frame-geometry"
import type * as CropUtils from "@/lib/editor/crop-utils"

const geometry = vi.hoisted(() => ({
  projectionFor: vi.fn(),
  drawImageToQuadWarp: vi.fn(),
}))

vi.mock(
  "@/lib/editor/animation-export/video-media/frame-geometry",
  async (importOriginal) => {
    const actual = await importOriginal<typeof FrameGeometry>()
    return {
      ...actual,
      projectionFor: geometry.projectionFor,
      drawImageToQuadWarp: geometry.drawImageToQuadWarp,
    }
  }
)
vi.mock("@/lib/editor/crop-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof CropUtils>()
  return { ...actual, supportsObjectViewBox: () => false }
})

import {
  buildForegroundLayer,
  buildFrameChromeLayer,
} from "@/lib/editor/animation-export/video-media/frame-renderer"
import { buildNativeInnerLightingLayer } from "@/lib/editor/animation-export/video-media/frame-inner-lighting"
import type { AnimationCapture } from "@/lib/editor/export"

let sampledAlpha = 255

class FakeContext {
  filter = "none"
  fillStyle = ""
  globalAlpha = 1
  constructor(readonly canvas: HTMLCanvasElement) {}
  beginPath() {}
  clearRect() {}
  clip() {}
  closePath() {}
  drawImage() {}
  fillRect() {}
  createLinearGradient() {
    return { addColorStop() {} } as unknown as CanvasGradient
  }
  createRadialGradient() {
    return { addColorStop() {} } as unknown as CanvasGradient
  }
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 3; i < data.length; i += 4) data[i] = sampledAlpha
    return { data }
  }
  lineTo() {}
  moveTo() {}
  restore() {}
  roundRect() {}
  save() {}
  setTransform() {}
  transform() {}
}

function rect(width: number, height: number, left = 0, top = 0) {
  return {
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
  } as DOMRect
}

function makeCapture() {
  const node = document.createElement("div")
  node.getBoundingClientRect = () => rect(1000, 625)
  const captureFrame = vi.fn(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 1000
    canvas.height = 625
    return canvas
  })
  return {
    node,
    width: 1000,
    height: 625,
    needsPaint: false,
    captureFrame,
    cleanup: () => {},
  } satisfies AnimationCapture
}

beforeEach(() => {
  sampledAlpha = 255
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      return new FakeContext(this) as unknown as CanvasRenderingContext2D
    }
  )
  geometry.projectionFor.mockReturnValue(null)
  geometry.drawImageToQuadWarp.mockReturnValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  geometry.projectionFor.mockReset()
  geometry.drawImageToQuadWarp.mockReset()
})

describe("Safari layer raster cache", () => {
  it("settles then reuses a flat foreground while only projection vars change", async () => {
    const capture = makeCapture()
    const foreground = document.createElement("div")
    foreground.dataset.exportStack = "foreground"
    foreground.getBoundingClientRect = () => rect(200, 100, 20, 30)
    capture.node.appendChild(foreground)
    const cache = {}
    await buildForegroundLayer(
      capture,
      [foreground],
      1,
      1000,
      625,
      "above",
      cache
    )
    capture.node.style.setProperty("--canvas-ts-rx", "18deg")
    await buildForegroundLayer(
      capture,
      [foreground],
      1,
      1000,
      625,
      "above",
      cache
    )

    expect(capture.captureFrame).toHaveBeenCalledTimes(2)

    foreground.style.opacity = "0.5"
    await buildForegroundLayer(
      capture,
      [foreground],
      1,
      1000,
      625,
      "above",
      cache
    )
    expect(capture.captureFrame).toHaveBeenCalledTimes(4)
  })

  it("captures frame chrome once and re-warps its texture for every quad", async () => {
    const capture = makeCapture()
    const shell = document.createElement("div")
    const chrome = document.createElement("div")
    chrome.dataset.exportFrameChrome = ""
    let chromeLeft = 100
    chrome.getBoundingClientRect = () => rect(800, 500, chromeLeft, 60)
    shell.appendChild(chrome)
    capture.node.appendChild(shell)
    const quad = {
      localW: 800,
      localH: 500,
      hasPerspective: true,
      projectH: (x: number, y: number) => ({ x, y, w: 1 }),
    }
    geometry.projectionFor.mockReturnValue({
      el: chrome,
      carrier: shell,
      quad,
    })
    const cache = {}
    await buildFrameChromeLayer(capture, shell, 1, 1000, 625, cache)
    // A new tilt changes the projected AABB and quad, but not the bezel pixels.
    chromeLeft = 140
    await buildFrameChromeLayer(capture, shell, 1, 1000, 625, cache)

    expect(capture.captureFrame).toHaveBeenCalledTimes(2)
    expect(geometry.drawImageToQuadWarp).toHaveBeenCalledTimes(2)
  })

  it("paints auxiliary passes directly into the frame canvas", async () => {
    const capture = makeCapture()
    const foreground = document.createElement("div")
    foreground.dataset.exportStack = "foreground"
    foreground.getBoundingClientRect = () => rect(200, 100, 20, 30)
    capture.node.appendChild(foreground)
    const destination = document.createElement("canvas")
    destination.width = 1000
    destination.height = 625
    const destinationCtx = destination.getContext(
      "2d"
    ) as CanvasRenderingContext2D
    const directForeground = buildForegroundLayer as unknown as (
      ...args: [
        AnimationCapture,
        HTMLElement[],
        number,
        number,
        number,
        string,
        object,
        CanvasRenderingContext2D,
      ]
    ) => ReturnType<typeof buildForegroundLayer>
    const directLighting = buildNativeInnerLightingLayer as unknown as (
      ...args: [
        HTMLElement,
        HTMLElement[],
        {
          target: "inner"
          intensity: number
          direction: string
          color: string
        },
        number,
        number,
        number,
        CanvasRenderingContext2D,
      ]
    ) => ReturnType<typeof buildNativeInnerLightingLayer>

    const foregroundResult = await directForeground(
      capture,
      [foreground],
      1,
      1000,
      625,
      "above",
      {},
      destinationCtx
    )
    const lightingResult = directLighting(
      capture.node,
      [foreground],
      {
        target: "inner",
        intensity: 50,
        direction: "2-2",
        color: "#ffffff",
      },
      1,
      1000,
      625,
      destinationCtx
    )

    expect(foregroundResult).toBe(destination)
    expect(lightingResult).toBe(destination)
  })

  it("does not freeze consecutive blank Safari captures in the cache", async () => {
    sampledAlpha = 0
    const capture = makeCapture()
    const foreground = document.createElement("div")
    foreground.dataset.exportStack = "foreground"
    foreground.getBoundingClientRect = () => rect(200, 100, 20, 30)
    capture.node.appendChild(foreground)

    await buildForegroundLayer(capture, [foreground], 1, 1000, 625, "blank", {})

    expect(capture.captureFrame).toHaveBeenCalledTimes(6)
  })
})
