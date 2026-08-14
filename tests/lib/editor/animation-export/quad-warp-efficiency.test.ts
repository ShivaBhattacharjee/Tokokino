import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  drawImageToQuadGL: vi.fn(() => true),
}))

vi.mock("@/lib/editor/animation-export/video-media/warp-gl", () => ({
  drawImageToQuadGL: mocks.drawImageToQuadGL,
}))

import { warpProjectedTexture } from "@/lib/editor/animation-export/video-media/frame-renderer"

describe("projected texture warp efficiency", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        return {
          canvas: this,
        } as unknown as CanvasRenderingContext2D
      }
    )
    mocks.drawImageToQuadGL.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mocks.drawImageToQuadGL.mockReset()
  })

  it("projects only the four corners when WebGL handles the warp", () => {
    const texture = document.createElement("canvas")
    texture.width = 640
    texture.height = 360
    const projectH = vi.fn((x: number, y: number) => ({ x, y, w: 1 }))

    const result = warpProjectedTexture(
      { texture, pad: 0, boxW: 640, boxH: 360 },
      {
        corners: [
          { x: 0, y: 0 },
          { x: 640, y: 0 },
          { x: 640, y: 360 },
          { x: 0, y: 360 },
        ],
        localW: 640,
        localH: 360,
        project: (x: number, y: number) => ({ x, y }),
        projectH,
        hasPerspective: true,
        origin: { x: 0, y: 0 },
      },
      1,
      1920,
      1080
    )

    expect(result).not.toBeNull()
    expect(mocks.drawImageToQuadGL).toHaveBeenCalledOnce()
    expect(projectH).toHaveBeenCalledTimes(4)
  })

  it("draws into a supplied frame context without allocating an output canvas", () => {
    const texture = document.createElement("canvas")
    texture.width = 640
    texture.height = 360
    const destination = document.createElement("canvas")
    destination.width = 1920
    destination.height = 1080
    const destinationCtx = {
      canvas: destination,
    } as unknown as CanvasRenderingContext2D
    const createElement = vi.spyOn(document, "createElement")

    const result = warpProjectedTexture(
      { texture, pad: 0, boxW: 640, boxH: 360 },
      {
        corners: [
          { x: 0, y: 0 },
          { x: 640, y: 0 },
          { x: 640, y: 360 },
          { x: 0, y: 360 },
        ],
        localW: 640,
        localH: 360,
        project: (x: number, y: number) => ({ x, y }),
        projectH: (x: number, y: number) => ({ x, y, w: 1 }),
        hasPerspective: true,
        origin: { x: 0, y: 0 },
      },
      1,
      1920,
      1080,
      destinationCtx
    )

    expect(result).toBe(destination)
    expect(createElement).not.toHaveBeenCalled()
  })
})
