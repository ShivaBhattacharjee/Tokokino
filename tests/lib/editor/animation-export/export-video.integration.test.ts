import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  acquireCapture: vi.fn(),
  clearAnimationFrameVars: vi.fn(),
  createVideoLayer: vi.fn(),
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
  encodeGif: vi.fn(),
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

function editorState() {
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
            durationMs: 1000,
            clips: [{ id: "keyframe-1", startMs: 0, durationMs: 1000 }],
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
})
