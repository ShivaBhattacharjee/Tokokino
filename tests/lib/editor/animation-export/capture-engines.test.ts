import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fast: vi.fn(),
  precise: vi.fn(),
}))

vi.mock("@/lib/editor/export", () => ({
  prepareFastAnimationCapture: mocks.fast,
  prepareAnimationCapture: mocks.precise,
}))

import { acquireAnimationCapture } from "@/lib/editor/animation-export/capture"

const capture = {
  node: document.createElement("div"),
  width: 1080,
  height: 608,
  needsPaint: false,
  captureFrame: vi.fn(),
  cleanup: vi.fn(),
}

afterEach(() => {
  mocks.fast.mockReset()
  mocks.precise.mockReset()
})

describe("Animate export capture engines", () => {
  it("uses the Fast engine when explicitly selected", async () => {
    mocks.fast.mockResolvedValue(capture)

    await expect(
      acquireAnimationCapture("canvas-1", 1080, "fast")
    ).resolves.toBe(capture)
    expect(mocks.fast).toHaveBeenCalledWith("canvas-1", 1080)
    expect(mocks.precise).not.toHaveBeenCalled()
  })

  it("uses the Precise engine when explicitly selected", async () => {
    mocks.precise.mockResolvedValue(capture)

    await expect(
      acquireAnimationCapture("canvas-1", 1080, "legacy")
    ).resolves.toBe(capture)
    expect(mocks.precise).toHaveBeenCalledWith("canvas-1", 1080)
    expect(mocks.fast).not.toHaveBeenCalled()
  })

  it("uses Fast under Auto when setup succeeds", async () => {
    mocks.fast.mockResolvedValue(capture)

    await expect(
      acquireAnimationCapture("canvas-1", 1080, "auto")
    ).resolves.toBe(capture)
    expect(mocks.fast).toHaveBeenCalledOnce()
    expect(mocks.precise).not.toHaveBeenCalled()
  })

  it("falls back from Auto to Precise when Fast setup fails", async () => {
    mocks.fast.mockRejectedValue(new Error("foreignObject unavailable"))
    mocks.precise.mockResolvedValue(capture)

    await expect(
      acquireAnimationCapture("canvas-1", 1080, "auto")
    ).resolves.toBe(capture)
    expect(mocks.fast).toHaveBeenCalledWith("canvas-1", 1080)
    expect(mocks.precise).toHaveBeenCalledWith("canvas-1", 1080)
  })
})
