import { afterEach, describe, expect, it, vi } from "vitest"

import {
  confirmVideoImport,
  FALLBACK_FREE_BYTES,
  measureVideoCapacity,
  requiredBytesFor,
  useVideoCapacityPrompt,
} from "@/lib/editor/video-capacity"

const GB = 1024 * 1024 * 1024

function stubEstimate(
  estimate: (() => Promise<StorageEstimate>) | null,
  persist?: { persisted: boolean; grant: boolean }
) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: estimate
      ? {
          estimate,
          persisted: async () => persist?.persisted ?? true,
          persist: async () => persist?.grant ?? true,
        }
      : undefined,
  })
}

afterEach(() => {
  stubEstimate(null)
  useVideoCapacityPrompt.setState({ pending: null })
  vi.restoreAllMocks()
})

describe("measureVideoCapacity", () => {
  it("passes a 4 GB video when the device has room to spare", async () => {
    stubEstimate(async () => ({ quota: 200 * GB, usage: 10 * GB }))
    expect(await measureVideoCapacity(4 * GB)).toMatchObject({ level: "ok" })
  })

  it("warns when a same-size swap would no longer fit", async () => {
    // 21 GB quota / 11 GB used — a 5 GB video saves, but replacing it needs
    // room for both copies inside one transaction.
    stubEstimate(async () => ({ quota: 21 * GB, usage: 11 * GB }))
    expect(await measureVideoCapacity(5 * GB)).toMatchObject({ level: "tight" })
  })

  it("requires two copies plus draft overhead to report ok", async () => {
    expect(requiredBytesFor(4 * GB)).toBe(9 * GB)
    stubEstimate(async () => ({ quota: 9 * GB, usage: 0 }))
    expect(await measureVideoCapacity(4 * GB)).toMatchObject({ level: "ok" })
    stubEstimate(async () => ({ quota: 9 * GB - 1, usage: 0 }))
    expect(await measureVideoCapacity(4 * GB)).toMatchObject({ level: "tight" })
  })

  it("reports whether the origin is safe from eviction", async () => {
    stubEstimate(async () => ({ quota: 200 * GB, usage: 0 }), {
      persisted: false,
      grant: false,
    })
    expect(await measureVideoCapacity(1 * GB)).toMatchObject({
      persisted: false,
    })
  })

  it("flags a file larger than the whole budget", async () => {
    stubEstimate(async () => ({ quota: 3 * GB, usage: 1 * GB }))
    expect(await measureVideoCapacity(4 * GB)).toMatchObject({
      level: "over",
      freeBytes: 2 * GB,
    })
  })

  it("falls back to a fixed budget when the browser reports no estimate", async () => {
    stubEstimate(null)
    expect(await measureVideoCapacity(FALLBACK_FREE_BYTES + 1)).toMatchObject({
      level: "over",
      freeBytes: null,
    })
    expect(await measureVideoCapacity(100 * 1024 * 1024)).toMatchObject({
      level: "ok",
    })
  })

  it("falls back when estimate() throws", async () => {
    stubEstimate(async () => {
      throw new Error("denied")
    })
    expect(await measureVideoCapacity(3 * GB)).toMatchObject({
      level: "ok",
      freeBytes: null,
    })
    expect(await measureVideoCapacity(4 * GB)).toMatchObject({
      level: "tight",
      freeBytes: null,
    })
  })
})

describe("confirmVideoImport", () => {
  it("imports without prompting when there is room", async () => {
    stubEstimate(async () => ({ quota: 200 * GB, usage: 0 }))
    await expect(confirmVideoImport({ size: 4 * GB } as File)).resolves.toBe(
      true
    )
    expect(useVideoCapacityPrompt.getState().pending).toBeNull()
  })

  it("waits on the user's answer when the budget is tight", async () => {
    stubEstimate(async () => ({ quota: 5 * GB, usage: 1 * GB }))
    const pending = confirmVideoImport({ size: 4 * GB } as File)
    await vi.waitFor(() =>
      expect(useVideoCapacityPrompt.getState().pending).not.toBeNull()
    )
    useVideoCapacityPrompt.getState().resolvePending(true)
    await expect(pending).resolves.toBe(true)
    expect(useVideoCapacityPrompt.getState().pending).toBeNull()
  })

  it("drops the import when the user cancels", async () => {
    stubEstimate(async () => ({ quota: 1 * GB, usage: 0 }))
    const pending = confirmVideoImport({ size: 4 * GB } as File)
    await vi.waitFor(() =>
      expect(useVideoCapacityPrompt.getState().pending).not.toBeNull()
    )
    useVideoCapacityPrompt.getState().resolvePending(false)
    await expect(pending).resolves.toBe(false)
  })

  it("cancels a prompt that a second import replaces", async () => {
    stubEstimate(async () => ({ quota: 1 * GB, usage: 0 }))
    const first = confirmVideoImport({ size: 4 * GB } as File)
    await vi.waitFor(() =>
      expect(useVideoCapacityPrompt.getState().pending).not.toBeNull()
    )
    const second = confirmVideoImport({ size: 5 * GB } as File)
    await expect(first).resolves.toBe(false)
    useVideoCapacityPrompt.getState().resolvePending(true)
    await expect(second).resolves.toBe(true)
  })
})
