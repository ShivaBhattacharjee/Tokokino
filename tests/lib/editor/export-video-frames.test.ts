import { afterEach, describe, expect, it, vi } from "vitest"

import { replaceCloneVideosWithFrames } from "@/lib/editor/export-video-frames"

describe("replaceCloneVideosWithFrames", () => {
  const drawImage = vi.fn()
  const originalGetContext = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "getContext"
  )

  afterEach(() => {
    if (originalGetContext)
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        "getContext",
        originalGetContext
      )
    drawImage.mockReset()
  })

  it("replaces a cloned same-origin video with its decoded frame", () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(
        () => ({ drawImage }) as unknown as CanvasRenderingContext2D
      ),
    })
    const source = document.createElement("div")
    const video = document.createElement("video")
    video.className = "object-cover rounded-xl"
    video.dataset.media = "main"
    Object.defineProperties(video, {
      videoWidth: { value: 1920 },
      videoHeight: { value: 1080 },
      currentSrc: { value: "/api/drafts/media/video-id" },
    })
    source.appendChild(video)
    const clone = source.cloneNode(true) as HTMLDivElement

    expect(replaceCloneVideosWithFrames(source, clone)).toBe(1)

    const frame = clone.querySelector("canvas")
    expect(frame).toHaveClass("object-cover", "rounded-xl")
    expect(frame).toHaveAttribute("data-media", "main")
    expect(frame).toHaveAttribute("width", "1920")
    expect(frame).toHaveAttribute("height", "1080")
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080)
  })
})
