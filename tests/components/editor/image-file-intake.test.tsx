import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as MediaType from "@/lib/editor/media-type"

/**
 * GIF intake. The user is asked to confirm a conversion to video, so a silent
 * fall back to a plain <img> hands them something they didn't ask for — no
 * timeline, no video bar — with nothing said about it.
 */
const media = vi.hoisted(() => ({
  transcodeGifToVideo: vi.fn(),
  registerObjectUrl: vi.fn(() => "blob:converted"),
}))

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock("@/lib/editor/gif-to-video", () => ({
  transcodeGifToVideo: media.transcodeGifToVideo,
}))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/lib/editor/media-type", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaType>()),
  registerObjectUrl: media.registerObjectUrl,
}))

import { useImageFileIntake } from "@/components/editor/canvas/use-image-file-intake"

const gif = () =>
  new File([new Uint8Array([1, 2, 3])], "demo.gif", {
    type: "image/gif",
  })

function setup() {
  const onImage = vi.fn()
  const { result } = renderHook(() => useImageFileIntake(onImage))
  act(() => result.current.readFile(gif()))
  return { onImage, result }
}

afterEach(() => vi.clearAllMocks())

describe("GIF intake", () => {
  it("uses the converted video when the transcode works", async () => {
    media.transcodeGifToVideo.mockResolvedValue(new Blob(["webm"]))
    const { onImage, result } = setup()

    await act(async () => result.current.confirmGifTranscode())

    await waitFor(() => expect(onImage).toHaveBeenCalledWith("blob:converted"))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("says so when the conversion falls back to a plain image", async () => {
    media.transcodeGifToVideo.mockResolvedValue(null)
    const { result } = setup()

    await act(async () => result.current.confirmGifTranscode())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not convert that GIF — added it as an image instead"
      )
    )
  })

  it("says so when the conversion throws", async () => {
    media.transcodeGifToVideo.mockRejectedValue(new Error("no WebCodecs"))
    const { result } = setup()

    await act(async () => result.current.confirmGifTranscode())

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not convert that GIF — added it as an image instead"
      )
    )
  })
})
