import { afterEach, describe, expect, it, vi } from "vitest"

import {
  afterPositionPreviewCleared,
  clearPositionPreviewVarsAfterPaint,
  POSITION_PREVIEW_VARS,
} from "@/lib/editor/live-preview-vars"

type FakeEl = { style: { removeProperty: ReturnType<typeof vi.fn> } }
const fakeEl = (): FakeEl => ({ style: { removeProperty: vi.fn() } })
const asEl = (el: FakeEl) => el as unknown as HTMLElement

// One-frame-at-a-time requestAnimationFrame: callbacks scheduled *during* a
// flush land in the next queue, so draining a double-rAF chain takes two
// flushes — matching real frame timing.
let frameQueue: FrameRequestCallback[] = []
const fakeRaf = (cb: FrameRequestCallback) => frameQueue.push(cb)
const flushFrame = () => {
  const current = frameQueue
  frameQueue = []
  for (const cb of current) cb(0)
}

afterEach(() => {
  vi.unstubAllGlobals()
  frameQueue = []
})

describe("clearPositionPreviewVarsAfterPaint", () => {
  it("clears synchronously when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    const el = fakeEl()
    clearPositionPreviewVarsAfterPaint([asEl(el)])
    expect(el.style.removeProperty).toHaveBeenCalledTimes(
      POSITION_PREVIEW_VARS.length
    )
  })

  it("honours a false predicate in the synchronous fallback", () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    const el = fakeEl()
    clearPositionPreviewVarsAfterPaint([asEl(el)], () => false)
    expect(el.style.removeProperty).not.toHaveBeenCalled()
  })

  it("defers cleanup to the scheduled frame, then runs it while the predicate stays true", () => {
    vi.stubGlobal("requestAnimationFrame", fakeRaf)
    const el = fakeEl()
    clearPositionPreviewVarsAfterPaint([asEl(el)], () => true)
    // Nothing happens until the frame fires.
    expect(el.style.removeProperty).not.toHaveBeenCalled()
    flushFrame()
    expect(el.style.removeProperty).toHaveBeenCalledTimes(
      POSITION_PREVIEW_VARS.length
    )
  })

  it("suppresses the scheduled cleanup when the predicate turns false before the frame runs", () => {
    vi.stubGlobal("requestAnimationFrame", fakeRaf)
    const el = fakeEl()
    let current = true
    clearPositionPreviewVarsAfterPaint([asEl(el)], () => current)
    current = false // a newer interaction took over
    flushFrame()
    expect(el.style.removeProperty).not.toHaveBeenCalled()
  })
})

describe("afterPositionPreviewCleared", () => {
  it("runs the callback synchronously when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    const cb = vi.fn()
    afterPositionPreviewCleared(cb)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it("skips the callback in the synchronous fallback when the predicate is false", () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    const cb = vi.fn()
    afterPositionPreviewCleared(cb, () => false)
    expect(cb).not.toHaveBeenCalled()
  })

  it("runs the callback only after the second frame while the predicate stays true", () => {
    vi.stubGlobal("requestAnimationFrame", fakeRaf)
    const cb = vi.fn()
    afterPositionPreviewCleared(cb, () => true)
    flushFrame() // outer frame schedules the inner
    expect(cb).not.toHaveBeenCalled()
    flushFrame() // inner frame runs
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it("suppresses the inner callback when the predicate turns false between the two frames", () => {
    vi.stubGlobal("requestAnimationFrame", fakeRaf)
    const cb = vi.fn()
    let current = true
    afterPositionPreviewCleared(cb, () => current)
    flushFrame() // outer frame; inner now scheduled
    current = false
    flushFrame() // inner frame checks the predicate
    expect(cb).not.toHaveBeenCalled()
  })
})
