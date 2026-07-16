import { describe, expect, it, beforeEach, vi } from "vitest"

import {
  isVideoSrcRevealed,
  markVideoSrcRevealed,
  requestVideoFrameReveal,
  subscribeVideoSrcReveal,
} from "@/lib/editor/video-frame-reveal"

type TestVideo = HTMLVideoElement & { __emit: (type: string) => void }

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): TestVideo {
  const listeners = new Map<string, Set<EventListener>>()
  return {
    currentSrc: "",
    videoWidth: 1280,
    videoHeight: 720,
    duration: 10,
    currentTime: 0,
    readyState: 0,
    networkState: 0,
    preload: "metadata",
    isConnected: true,
    addEventListener: (type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(cb)
    },
    removeEventListener: (type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb)
    },
    getAttribute: () => null,
    load: vi.fn(),
    __emit(type: string) {
      for (const cb of listeners.get(type) ?? []) {
        cb(new Event(type))
      }
    },
    ...overrides,
  } as unknown as TestVideo
}

describe("video-frame-reveal", () => {
  beforeEach(() => {
    // Module state persists across tests — mark unique srcs per assertion.
  })

  it("notifies subscribers when a src is revealed", () => {
    const src = `blob:test-${Math.random()}`
    expect(isVideoSrcRevealed(src)).toBe(false)
    let calls = 0
    const unsub = subscribeVideoSrcReveal(() => {
      calls += 1
    })
    markVideoSrcRevealed(src)
    expect(isVideoSrcRevealed(src)).toBe(true)
    expect(calls).toBe(1)
    markVideoSrcRevealed(src)
    expect(calls).toBe(1)
    unsub()
  })

  it("requestVideoFrameReveal paints once metadata is ready", () => {
    const src = `blob:reveal-${Math.random()}`
    const video = makeVideo({
      currentSrc: src,
      readyState: HTMLMediaElement.HAVE_METADATA,
    })

    requestVideoFrameReveal(video, src)
    // Seeking is async — seeked event marks revealed.
    expect(isVideoSrcRevealed(src)).toBe(false)
    video.__emit("seeked")
    expect(isVideoSrcRevealed(src)).toBe(true)
  })

  it("requestVideoFrameReveal is a no-op when already revealed", () => {
    const src = `blob:once-${Math.random()}`
    markVideoSrcRevealed(src)
    const video = makeVideo({
      currentSrc: src,
      readyState: HTMLMediaElement.HAVE_METADATA,
    })
    const before = video.currentTime
    requestVideoFrameReveal(video, src)
    expect(video.currentTime).toBe(before)
  })
})
