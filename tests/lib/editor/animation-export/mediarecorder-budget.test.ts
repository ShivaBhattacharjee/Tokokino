import { afterEach, describe, expect, it, vi } from "vitest"

import type * as AnimationExportUtils from "@/lib/editor/animation-export/utils"

const mocks = vi.hoisted(() => ({
  captureStableFrame: vi.fn(),
  pickWebmMimeType: vi.fn(),
}))

// The MediaRecorder fallback bails on an unsupported container before it ever
// reaches the memory guard, and jsdom has no MediaRecorder — so pin the mime.
vi.mock("@/lib/editor/animation-export/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof AnimationExportUtils>()),
  pickWebmMimeType: mocks.pickWebmMimeType,
}))

vi.mock("@/lib/editor/animation-export/capture", () => ({
  captureStableFrame: mocks.captureStableFrame,
}))

import {
  MAX_MEDIARECORDER_TOTAL_PIXELS,
  encodeWebmMediaRecorder,
} from "@/lib/editor/animation-export/video"

type RecorderCtx = Parameters<typeof encodeWebmMediaRecorder>[0]

function ctxFor(
  frameCount: number,
  width: number,
  height: number
): RecorderCtx {
  return {
    capture: {
      node: document.createElement("div"),
      width,
      height,
      needsPaint: false,
      captureFrame: vi.fn(),
      cleanup: vi.fn(),
    },
    canvas: { id: "canvas-1", screenshot: null },
    globalAspect: { id: "wide", w: 16, h: 9 },
    clips: [],
    frameCount,
    frameDurationMs: 1000 / 30,
    fps: 30,
    progress: { report: vi.fn() },
    watermark: null,
    videoLayer: null,
    durationMs: (frameCount / 30) * 1000,
    // Only the fields the budget guard and the capture loop read are populated.
  } as unknown as RecorderCtx
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("MediaRecorder WebM fallback memory budget", () => {
  it("rejects an over-budget workload before capturing any frame", async () => {
    mocks.pickWebmMimeType.mockReturnValue("video/webm")
    // 1080p × 200 frames ≈ 414M px, well past the 150M budget.
    const frameCount = 200
    expect(frameCount * 1920 * 1080).toBeGreaterThan(
      MAX_MEDIARECORDER_TOTAL_PIXELS
    )

    await expect(
      encodeWebmMediaRecorder(ctxFor(frameCount, 1920, 1080))
    ).rejects.toThrow(/too long for your browser to export/)

    // The whole point of the guard: fail before allocating any of it.
    expect(mocks.captureStableFrame).not.toHaveBeenCalled()
  })

  it("lets a within-budget workload through to frame capture", async () => {
    mocks.pickWebmMimeType.mockReturnValue("video/webm")
    mocks.captureStableFrame.mockRejectedValue(new Error("stop after guard"))
    const frameCount = 10
    expect(frameCount * 1920 * 1080).toBeLessThan(
      MAX_MEDIARECORDER_TOTAL_PIXELS
    )

    await expect(
      encodeWebmMediaRecorder(ctxFor(frameCount, 1920, 1080))
    ).rejects.toThrow("stop after guard")

    expect(mocks.captureStableFrame).toHaveBeenCalled()
  })

  it("still reports the unsupported-container error ahead of the budget", async () => {
    mocks.pickWebmMimeType.mockReturnValue(null)

    await expect(
      encodeWebmMediaRecorder(ctxFor(10_000, 1920, 1080))
    ).rejects.toThrow(/isn't supported in this browser/)
  })
})
