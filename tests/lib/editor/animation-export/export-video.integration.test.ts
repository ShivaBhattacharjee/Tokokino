import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  acquireCapture: vi.fn(),
  clearAnimationFrameVars: vi.fn(),
  createVideoLayer: vi.fn(),
  encodeGif: vi.fn(),
  encodeVideo: vi.fn(),
  getState: vi.fn(),
  isVideoSrc: vi.fn(),
  progressReport: vi.fn(),
  suppressCloneTransitions: vi.fn(),
}))

vi.mock("@/lib/editor/apply-animation-frame", () => ({
  clearAnimationFrameVars: mocks.clearAnimationFrameVars,
}))

vi.mock("@/lib/editor/media-type", () => ({
  isVideoSrc: mocks.isVideoSrc,
}))

vi.mock("@/lib/editor/store", () => ({
  captureClipPose: vi.fn(),
  useEditorStore: { getState: mocks.getState },
}))

vi.mock("@/lib/editor/animation-export/capture", () => ({
  acquireAnimationCapture: mocks.acquireCapture,
  suppressCloneTransitions: mocks.suppressCloneTransitions,
}))

vi.mock("@/lib/editor/animation-export/video-layer", () => ({
  prepareCloneVideoLayer: mocks.createVideoLayer,
}))

vi.mock("@/lib/editor/animation-export/gif", () => ({
  MAX_GIF_FPS: 50,
  encodeGif: mocks.encodeGif,
}))

vi.mock("@/lib/editor/animation-export/video", () => ({
  encodeWebmMediaRecorder: vi.fn(),
  tryEncodeWithMediabunny: mocks.encodeVideo,
}))

vi.mock("@/lib/editor/animation-export/watermark", () => ({
  loadWatermarkLogo: vi.fn(),
  resolveWatermarkFontStack: vi.fn(),
}))

vi.mock("@/lib/editor/animation-export/utils", () => ({
  AnimationExportAbortedError: class AnimationExportAbortedError extends Error {},
  animationMimeAndExt: (format: string) => ({
    contentType: `video/${format}`,
    extension: format,
  }),
  createProgressReporter: () => ({ report: mocks.progressReport }),
  resolveAnimationDownloadFilename: vi.fn(),
  throwIfAborted: vi.fn(),
  triggerDownload: vi.fn(),
}))

import { exportAnimationBlob } from "@/lib/editor/animation-export"

const capture = {
  node: document.createElement("div"),
  width: 1080,
  height: 608,
  needsPaint: false,
  captureFrame: vi.fn(),
  cleanup: vi.fn(),
}

const videoLayer = {
  paint: vi.fn(),
  sourceDurationMs: 7000,
  cleanup: vi.fn(),
}

function editorState(durationMs = 1000) {
  return {
    isAnimateMode: false,
    selectedAnimationClipId: null,
    present: {
      aspect: { id: "wide", w: 16, h: 9 },
      canvases: [
        {
          id: "canvas-1",
          screenshot: "blob:source-video",
          videoClips: [],
          animation: {
            durationMs,
            clips: [{ id: "keyframe-1", startMs: 0, durationMs }],
          },
        },
      ],
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("Animate video export coordinator", () => {
  it.each(["auto", "fast", "legacy"] as const)(
    "passes the %s capture selection through a video export and releases both layers",
    async (engine) => {
      const encoded = new Blob(["video"], { type: "video/mp4" })
      mocks.getState.mockReturnValue(editorState())
      mocks.isVideoSrc.mockReturnValue(true)
      mocks.acquireCapture.mockResolvedValue(capture)
      mocks.createVideoLayer.mockResolvedValue(videoLayer)
      mocks.encodeVideo.mockResolvedValue(encoded)

      const result = await exportAnimationBlob("canvas-1", {
        format: "mp4",
        capture: engine,
        watermark: false,
      })

      expect(result).toEqual({
        blob: encoded,
        contentType: "video/mp4",
        extension: "mp4",
      })
      expect(mocks.acquireCapture).toHaveBeenCalledWith(
        "canvas-1",
        1080,
        engine
      )
      expect(mocks.suppressCloneTransitions).toHaveBeenCalledWith(capture.node)
      expect(mocks.createVideoLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          node: capture.node,
          src: "blob:source-video",
          videoClips: [],
        })
      )
      expect(mocks.encodeVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          capture,
          videoLayer,
          fps: 30,
          frameCount: 30,
        }),
        "mp4"
      )
      expect(videoLayer.cleanup).toHaveBeenCalledOnce()
      expect(capture.cleanup).toHaveBeenCalledOnce()
      expect(mocks.clearAnimationFrameVars).toHaveBeenCalledWith(
        capture.node,
        editorState().present.canvases[0].animation.clips
      )
    }
  )

  // Regression: the frame count used to be clamped to 600, so anything past 20 s
  // at 30 fps was silently cut off mid-animation with no error.
  it("covers the whole timeline instead of truncating long animations", async () => {
    mocks.getState.mockReturnValue(editorState(5 * 60 * 1000))
    mocks.isVideoSrc.mockReturnValue(false)
    mocks.acquireCapture.mockResolvedValue(capture)
    mocks.encodeVideo.mockResolvedValue(
      new Blob(["video"], {
        type: "video/mp4",
      })
    )

    await exportAnimationBlob("canvas-1", {
      format: "mp4",
      fps: 30,
      watermark: false,
    })

    expect(mocks.encodeVideo).toHaveBeenCalledWith(
      expect.objectContaining({ frameCount: 5 * 60 * 30 }),
      "mp4"
    )
  })

  // GIF delays are whole centiseconds with a 2cs floor, so >50fps can't play
  // faster — it just stretches the clip (60fps ran 20% long). Clamp has to land
  // before frameCount so the plan and the emitted delays agree.
  it("clamps GIF exports to MAX_GIF_FPS and plans frames at the clamped rate", async () => {
    mocks.getState.mockReturnValue(editorState(2000))
    mocks.isVideoSrc.mockReturnValue(false)
    mocks.acquireCapture.mockResolvedValue(capture)
    mocks.encodeGif.mockResolvedValue(new Blob(["gif"], { type: "image/gif" }))

    await exportAnimationBlob("canvas-1", {
      format: "gif",
      fps: 60,
      watermark: false,
    })

    expect(mocks.encodeGif).toHaveBeenCalledWith(
      expect.objectContaining({ fps: 50, frameCount: 100 })
    )
  })

  it("leaves 60fps alone for video formats", async () => {
    mocks.getState.mockReturnValue(editorState(2000))
    mocks.isVideoSrc.mockReturnValue(false)
    mocks.acquireCapture.mockResolvedValue(capture)
    mocks.encodeVideo.mockResolvedValue(new Blob(["v"], { type: "video/mp4" }))

    await exportAnimationBlob("canvas-1", {
      format: "mp4",
      fps: 60,
      watermark: false,
    })

    expect(mocks.encodeVideo).toHaveBeenCalledWith(
      expect.objectContaining({ fps: 60, frameCount: 120 }),
      "mp4"
    )
  })
})
