import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createDecodedFrameSource: vi.fn(),
  waitForVideoReady: vi.fn(),
}))

vi.mock("@/lib/editor/animation-export/video-media/decoded-frames", () => ({
  createDecodedFrameSource: mocks.createDecodedFrameSource,
}))

vi.mock("@/lib/editor/animation-export/video-media/dom-video", () => ({
  waitForVideoReady: mocks.waitForVideoReady,
}))

import {
  prepareCloneVideoLayer,
  resolveVideoSegments,
  resolveVideoSourceTimeMs,
} from "@/lib/editor/animation-export/video-layer"
import type { VideoTimelineClip } from "@/lib/editor/state-types"

const DURATION = 10_000
const originalImageDecode = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "decode"
)
const originalNaturalWidth = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "naturalWidth"
)
const originalNaturalHeight = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "naturalHeight"
)

function mockImageDimensions(width: number, height: number) {
  // jsdom versions differ on whether HTMLImageElement#decode exists. Define
  // the browser contract explicitly so these export tests stay DOM-runtime
  // independent rather than relying on a particular jsdom implementation.
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    configurable: true,
    get: () => height,
  })
}

function restoreImagePrototypeProperty(
  property: "decode" | "naturalWidth" | "naturalHeight",
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(HTMLImageElement.prototype, property, descriptor)
  } else {
    Reflect.deleteProperty(HTMLImageElement.prototype, property)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  mocks.createDecodedFrameSource.mockReset()
  mocks.waitForVideoReady.mockReset()
  restoreImagePrototypeProperty("decode", originalImageDecode)
  restoreImagePrototypeProperty("naturalWidth", originalNaturalWidth)
  restoreImagePrototypeProperty("naturalHeight", originalNaturalHeight)
})

describe("resolveVideoSegments", () => {
  it("uses one full-source segment when no timeline clips exist", () => {
    expect(resolveVideoSegments([], DURATION)).toEqual([
      {
        sourceStartMs: 0,
        sourceEndMs: DURATION,
        timelineStartMs: 0,
      },
    ])
  })

  it("clamps invalid trim and timeline values to the source bounds", () => {
    const clips: VideoTimelineClip[] = [
      {
        id: "invalid",
        timelineStartMs: -500,
        startMs: -1_000,
        endMs: 30_000,
      },
    ]

    expect(resolveVideoSegments(clips, DURATION)).toEqual([
      {
        sourceStartMs: 0,
        sourceEndMs: DURATION,
        timelineStartMs: 0,
      },
    ])
  })

  it("keeps split timeline clips independent after normalization", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 7_000, endMs: 12_000 },
      { id: "b", timelineStartMs: 3_000, startMs: 1_000, endMs: 3_000 },
    ]

    expect(resolveVideoSegments(clips, DURATION)).toEqual([
      { sourceStartMs: 7_000, sourceEndMs: DURATION, timelineStartMs: 0 },
      { sourceStartMs: 1_000, sourceEndMs: 3_000, timelineStartMs: 3_000 },
    ])
  })
})

describe("resolveVideoSourceTimeMs", () => {
  it("plays the whole source when no clips are set", () => {
    expect(resolveVideoSourceTimeMs([], 0, DURATION)).toBe(0)
    expect(resolveVideoSourceTimeMs([], 4_000, DURATION)).toBe(4_000)
  })

  it("offsets into the source by the clip's trim start", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 2_000, endMs: 6_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 0, DURATION)).toBe(2_000)
    expect(resolveVideoSourceTimeMs(clips, 1_500, DURATION)).toBe(3_500)
  })

  it("holds the last frame past the clip's end", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 0, endMs: 3_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 2_999, DURATION)).toBe(2_999)
    expect(resolveVideoSourceTimeMs(clips, 3_000, DURATION)).toBeNull()
  })

  it("holds before a clip that starts later on the timeline", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 5_000, startMs: 0, endMs: 2_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 4_999, DURATION)).toBeNull()
    expect(resolveVideoSourceTimeMs(clips, 5_000, DURATION)).toBe(0)
    expect(resolveVideoSourceTimeMs(clips, 6_000, DURATION)).toBe(1_000)
  })

  it("maps each split clip back to its own slice of the source", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 6_000, endMs: 8_000 },
      { id: "b", timelineStartMs: 2_000, startMs: 1_000, endMs: 3_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 500, DURATION)).toBe(6_500)
    expect(resolveVideoSourceTimeMs(clips, 2_500, DURATION)).toBe(1_500)
  })

  it("clamps trims that outlast the source", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", timelineStartMs: 0, startMs: 0, endMs: 30_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 9_999, DURATION)).toBe(9_999)
    expect(resolveVideoSourceTimeMs(clips, 12_000, DURATION)).toBeNull()
  })

  it("falls back to the trim start when a clip has no timeline position", () => {
    const clips: VideoTimelineClip[] = [
      { id: "a", startMs: 3_000, endMs: 5_000 },
    ]
    expect(resolveVideoSourceTimeMs(clips, 3_000, DURATION)).toBe(3_000)
    expect(resolveVideoSourceTimeMs(clips, 2_999, DURATION)).toBeNull()
  })
})

describe("prepareCloneVideoLayer — Animate export frame bridge", () => {
  it("replaces the clone video with a JPEG frame image and preserves layout attributes", async () => {
    const node = document.createElement("div")
    node.innerHTML = `
      <video class="absolute object-cover" style="border-radius: 24px" src="blob:clip"
        poster="poster.jpg" controls muted data-export-stack="media"></video>
    `
    const video = node.querySelector("video")!
    Object.defineProperty(video, "duration", {
      value: 7.05,
      configurable: true,
    })

    const decodedFrame = document.createElement("canvas")
    decodedFrame.width = 1920
    decodedFrame.height = 1080
    const decoded = {
      getFrameAt: vi.fn().mockResolvedValue(decodedFrame),
      cleanup: vi.fn(),
    }
    mocks.createDecodedFrameSource.mockResolvedValue(decoded)
    mocks.waitForVideoReady.mockResolvedValue(undefined)

    const drawImage = vi.fn()
    const clearRect = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      clearRect,
    } as unknown as CanvasRenderingContext2D)
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/jpeg;base64,frame")
    mockImageDimensions(1920, 1080)

    const layer = await prepareCloneVideoLayer({
      node,
      src: "blob:clip",
      videoClips: [],
    })

    expect(layer?.sourceDurationMs).toBe(7050)
    expect(node.querySelector("video")).toBeNull()
    const image = node.querySelector("img")!
    expect(image.className).toBe("absolute object-cover")
    expect(image.style.borderRadius).toBe("24px")
    expect(image.getAttribute("data-export-stack")).toBe("media")
    expect(image.hasAttribute("src")).toBe(true)
    expect(image.hasAttribute("poster")).toBe(false)
    expect(image.hasAttribute("controls")).toBe(false)
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92)
    expect(drawImage).toHaveBeenCalledWith(decodedFrame, 0, 0, 1920, 1080)

    await layer?.paint(1000)
    expect(decoded.getFrameAt).toHaveBeenLastCalledWith(1)

    layer?.cleanup()
    expect(decoded.cleanup).toHaveBeenCalledOnce()
  })

  it("holds the last good image outside of timeline clips instead of blanking it", async () => {
    const node = document.createElement("div")
    const video = document.createElement("video")
    node.appendChild(video)
    Object.defineProperty(video, "duration", { value: 5, configurable: true })

    const frame = document.createElement("canvas")
    frame.width = 320
    frame.height = 180
    const decoded = {
      getFrameAt: vi.fn().mockResolvedValue(frame),
      cleanup: vi.fn(),
    }
    mocks.createDecodedFrameSource.mockResolvedValue(decoded)
    mocks.waitForVideoReady.mockResolvedValue(undefined)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,frame"
    )
    mockImageDimensions(320, 180)

    const layer = await prepareCloneVideoLayer({
      node,
      src: "blob:clip",
      videoClips: [
        { id: "clip", timelineStartMs: 1000, startMs: 2000, endMs: 4000 },
      ],
    })

    expect(decoded.getFrameAt).toHaveBeenCalledWith(2)
    await layer?.paint(999)
    expect(decoded.getFrameAt).toHaveBeenCalledTimes(1)
    await layer?.paint(1000)
    expect(decoded.getFrameAt).toHaveBeenLastCalledWith(2)
  })
})
