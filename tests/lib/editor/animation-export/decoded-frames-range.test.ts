import { beforeEach, describe, expect, it, vi } from "vitest"

import type * as FrameRange from "@/lib/editor/animation-export/video-media/frame-range"

/**
 * `createDecodedFrameSource` is wrapped around mediabunny, so the decoder,
 * container parsing and WebCodecs are all stubbed out. What is under test is the
 * repair flow this project added on top: the range check has to measure a frame
 * BEFORE it is repaired, and a canvas handed out for several output frames must
 * only be expanded once.
 */

const mocks = vi.hoisted(() => ({
  canvases: vi.fn(),
  expandLimitedRange: vi.fn(),
  decodedNeedsRangeExpansion: vi.fn(() => true),
  drawVideoReference: vi.fn(() => ({ reference: true })),
}))

vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryVideoTrack() {
      return Promise.resolve({
        getCodec: () => Promise.resolve("avc"),
        getDecoderConfig: () => Promise.resolve({ codec: "avc1.42001f" }),
        canDecode: () => Promise.resolve(true),
      })
    }
    dispose() {}
  },
  CanvasSink: class {
    canvases(from: number) {
      return mocks.canvases(from) as unknown
    }
  },
}))

vi.mock("@/lib/editor/animation-export/video-media/dav1d-av1-decoder", () => ({
  isSupportedAv1Profile: () => false,
  registerDav1dAv1Decoder: () => {},
}))

vi.mock("@/lib/editor/animation-export/video-media/frame-range", async () => {
  const actual = await vi.importActual<typeof FrameRange>(
    "@/lib/editor/animation-export/video-media/frame-range"
  )
  return {
    ...actual,
    expandLimitedRange: mocks.expandLimitedRange,
    decodedNeedsRangeExpansion: mocks.decodedNeedsRangeExpansion,
    drawVideoReference: mocks.drawVideoReference,
  }
})

import { createDecodedFrameSource } from "@/lib/editor/animation-export/video-media/decoded-frames"

/** A canvas the range helpers will accept as a measurable frame. */
const frameCanvas = (id: string) => {
  const canvas = document.createElement("canvas")
  canvas.width = 4
  canvas.height = 4
  canvas.dataset.id = id
  return canvas
}

/** An async iterator of `{ timestamp, canvas }` like mediabunny's CanvasSink. */
const sinkOf = (frames: { timestamp: number; canvas: HTMLCanvasElement }[]) =>
  vi.fn(() => {
    let i = 0
    return {
      next: () =>
        Promise.resolve(
          i < frames.length
            ? { done: false, value: frames[i++] }
            : { done: true, value: undefined }
        ),
      return: () => Promise.resolve({ done: true, value: undefined }),
    }
  })

const video = { videoWidth: 640, videoHeight: 360 } as HTMLVideoElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.decodedNeedsRangeExpansion.mockReturnValue(true)
  mocks.drawVideoReference.mockReturnValue({ reference: true })
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve({}) }))
  )
  vi.stubGlobal("VideoDecoder", {
    isConfigSupported: () => Promise.resolve({ supported: true }),
  })
})

describe("createDecodedFrameSource range repair", () => {
  it("measures the frame before repairing it", async () => {
    const first = frameCanvas("a")
    mocks.canvases = sinkOf([{ timestamp: 0, canvas: first }])
    const order: string[] = []
    mocks.decodedNeedsRangeExpansion.mockImplementation(() => {
      order.push("measure")
      return true
    })
    mocks.expandLimitedRange.mockImplementation(() => {
      order.push("expand")
    })

    const source = await createDecodedFrameSource("blob:clip")
    await source!.calibrateRange(video, 0)

    // Reversed, the check would read already-expanded pixels and conclude the
    // engine was fine — the repair would disable itself after one frame.
    expect(order).toEqual(["measure", "expand"])
  })

  it("expands a canvas once however many output frames land on it", async () => {
    const shared = frameCanvas("shared")
    mocks.canvases = sinkOf([{ timestamp: 0, canvas: shared }])

    const source = await createDecodedFrameSource("blob:clip")
    await source!.calibrateRange(video, 0)
    // Exporting above the source's frame rate replays one decoded frame.
    await source!.getFrameAt(0.01)
    await source!.getFrameAt(0.02)
    await source!.getFrameAt(0.03)

    expect(mocks.expandLimitedRange).toHaveBeenCalledTimes(1)
    expect(mocks.expandLimitedRange).toHaveBeenCalledWith(shared)
  })

  it("expands each distinct frame once", async () => {
    const a = frameCanvas("a")
    const b = frameCanvas("b")
    mocks.canvases = sinkOf([
      { timestamp: 0, canvas: a },
      { timestamp: 1, canvas: b },
    ])

    const source = await createDecodedFrameSource("blob:clip")
    await source!.calibrateRange(video, 0)
    await source!.getFrameAt(1)
    await source!.getFrameAt(1)

    expect(mocks.expandLimitedRange).toHaveBeenCalledTimes(2)
    const graded = mocks.expandLimitedRange.mock.calls.map(
      (call) => call[0] as HTMLCanvasElement
    )
    expect(graded).toEqual([a, b])
  })

  it("repairs nothing when the engine converts correctly", async () => {
    mocks.decodedNeedsRangeExpansion.mockReturnValue(false)
    mocks.canvases = sinkOf([{ timestamp: 0, canvas: frameCanvas("a") }])

    const source = await createDecodedFrameSource("blob:clip")
    await source!.calibrateRange(video, 0)
    await source!.getFrameAt(0)

    expect(mocks.expandLimitedRange).not.toHaveBeenCalled()
  })

  it("repairs nothing when calibration never runs", async () => {
    mocks.canvases = sinkOf([{ timestamp: 0, canvas: frameCanvas("a") }])

    const source = await createDecodedFrameSource("blob:clip")
    await source!.getFrameAt(0)

    expect(mocks.decodedNeedsRangeExpansion).not.toHaveBeenCalled()
    expect(mocks.expandLimitedRange).not.toHaveBeenCalled()
  })

  it("declines when the reference frame cannot be drawn", async () => {
    mocks.drawVideoReference.mockReturnValue(
      null as unknown as { reference: boolean }
    )
    mocks.canvases = sinkOf([{ timestamp: 0, canvas: frameCanvas("a") }])

    const source = await createDecodedFrameSource("blob:clip")
    await source!.calibrateRange(video, 0)
    await source!.getFrameAt(0)

    expect(mocks.decodedNeedsRangeExpansion).not.toHaveBeenCalled()
    expect(mocks.expandLimitedRange).not.toHaveBeenCalled()
  })
})
