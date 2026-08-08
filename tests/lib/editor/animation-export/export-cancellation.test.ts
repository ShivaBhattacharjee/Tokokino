import { afterEach, describe, expect, it, vi } from "vitest"

import { AnimationExportAbortedError } from "@/lib/editor/animation-export/abort"
import { loadAudioSourceBlob } from "@/lib/editor/animation-export/video-media/audio"
import { createVideoMuxSession } from "@/lib/editor/animation-export/workers/video-muxer-client"
import type { VideoMuxerConfig } from "@/lib/editor/animation-export/workers/video-muxer-protocol"

const CONFIG: VideoMuxerConfig = {
  format: "mp4",
  width: 640,
  height: 480,
  fps: 30,
  keyFrameIntervalSec: 2,
  audio: null,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("loadAudioSourceBlob", () => {
  it("returns the blob when the source reads", async () => {
    const blob = new Blob(["x"])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
    )
    await expect(loadAudioSourceBlob("blob:clip")).resolves.toBe(blob)
  })

  it("returns null for an unreadable source — audio is best-effort", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("gone")))
    await expect(loadAudioSourceBlob("blob:clip")).resolves.toBeNull()
  })

  it("does not fetch at all once the export is cancelled", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      loadAudioSourceBlob("blob:clip", AbortSignal.abort())
    ).rejects.toBeInstanceOf(AnimationExportAbortedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports a cancelled fetch as an abort, not as missing audio", async () => {
    // Returning null here would carry the export on into a silent encode
    // instead of stopping it.
    const controller = new AbortController()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        controller.abort()
        return Promise.reject(new DOMException("Aborted", "AbortError"))
      })
    )
    await expect(
      loadAudioSourceBlob("blob:clip", controller.signal)
    ).rejects.toBeInstanceOf(AnimationExportAbortedError)
  })
})

describe("createVideoMuxSession", () => {
  it("throws instead of starting the worker when the signal already aborted", async () => {
    // An abort that has already fired never fires again, so the session's own
    // abort listener would never run — the worker would decode the whole audio
    // track and start the muxer before the cancellation surfaced.
    await expect(
      createVideoMuxSession(CONFIG, AbortSignal.abort())
    ).rejects.toBeInstanceOf(AnimationExportAbortedError)
  })

  it("returns null without a signal when the environment has no worker", async () => {
    // jsdom has neither Worker nor WebCodecs, so callers fall back in-process.
    await expect(createVideoMuxSession(CONFIG)).resolves.toBeNull()
  })
})
