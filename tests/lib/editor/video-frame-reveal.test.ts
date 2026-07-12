import { describe, expect, it, beforeEach } from "vitest"

import {
  isVideoSrcRevealed,
  markVideoSrcRevealed,
  subscribeVideoSrcReveal,
} from "@/lib/editor/video-frame-reveal"

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
})
