import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createVideoSeeker } from "@/lib/editor/video-seek"

type TestVideo = HTMLVideoElement & {
  /** Fire the browser's `seeked` for the pending seek. */
  __seeked: () => void
  /** Every value assigned to `currentTime`, in order. */
  __seeks: number[]
}

function makeVideo(): TestVideo {
  const listeners = new Map<string, Set<EventListener>>()
  const seeks: number[] = []
  let time = 0

  return {
    get currentTime() {
      return time
    },
    set currentTime(next: number) {
      time = next
      seeks.push(next)
    },
    addEventListener: (type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(cb)
    },
    removeEventListener: (type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb)
    },
    __seeked() {
      for (const cb of [...(listeners.get("seeked") ?? [])]) {
        cb(new Event("seeked"))
      }
    },
    __seeks: seeks,
  } as unknown as TestVideo
}

describe("createVideoSeeker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("issues the first seek immediately", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1.5)

    expect(video.__seeks).toEqual([1.5])
  })

  it("holds later seeks while one is in flight", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    seeker.seek(video, 1.1)
    seeker.seek(video, 1.2)

    expect(video.__seeks).toEqual([1])
  })

  it("settles on the newest target, skipping the ones swept past", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    seeker.seek(video, 1.1)
    seeker.seek(video, 1.2)
    video.__seeked()

    // 1.1 is dropped — the pointer had already moved on to 1.2.
    expect(video.__seeks).toEqual([1, 1.2])

    video.__seeked()
    expect(video.__seeks).toEqual([1, 1.2])
  })

  it("keeps accepting seeks after the queue drains", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    video.__seeked()
    seeker.seek(video, 2)

    expect(video.__seeks).toEqual([1, 2])
  })

  it("ignores a seek to the position already showing", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    video.__seeked()
    seeker.seek(video, 1)
    seeker.seek(video, 1.0000001)

    expect(video.__seeks).toEqual([1])
  })

  it("recovers when the decoder swallows `seeked`", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    seeker.seek(video, 2)
    // No `seeked` ever arrives — without the timeout the scrubber would wedge.
    expect(video.__seeks).toEqual([1])

    vi.advanceTimersByTime(1500)
    expect(video.__seeks).toEqual([1, 2])
  })

  it("does not wait on the previous canvas's video", () => {
    const seeker = createVideoSeeker()
    const first = makeVideo()
    const second = makeVideo()

    seeker.seek(first, 1)
    seeker.seek(second, 3)

    expect(second.__seeks).toEqual([3])
  })

  it("drops a stale settle from an element it no longer owns", () => {
    const seeker = createVideoSeeker()
    const first = makeVideo()
    const second = makeVideo()

    seeker.seek(first, 1)
    seeker.seek(second, 3)
    seeker.seek(second, 4)
    // The old element finally answers; it must not release the new one's queue.
    first.__seeked()

    expect(second.__seeks).toEqual([3])

    second.__seeked()
    expect(second.__seeks).toEqual([3, 4])
  })

  it("leaves the live settle timer alone when a stale element answers", () => {
    const seeker = createVideoSeeker()
    const first = makeVideo()
    const second = makeVideo()

    seeker.seek(first, 1)
    seeker.seek(second, 3)
    seeker.seek(second, 4)
    first.__seeked()
    // `second` never answers; its timeout must still fire the queued 4.
    vi.advanceTimersByTime(1500)

    expect(second.__seeks).toEqual([3, 4])
  })

  it("stops the settle timer on dispose", () => {
    const seeker = createVideoSeeker()
    const video = makeVideo()

    seeker.seek(video, 1)
    seeker.seek(video, 2)
    seeker.dispose()
    vi.advanceTimersByTime(5000)

    expect(video.__seeks).toEqual([1])
  })
})
