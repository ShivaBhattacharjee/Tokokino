import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useEditorStore } from "@/lib/editor/store"
import type { CustomPresetSummary } from "@/lib/editor/store"

/**
 * A failed preset load used to land on `customPresetsLoaded` with an empty list,
 * which the picker renders as "No custom presets yet" — telling the user their
 * saved presets don't exist. `customPresetsError` keeps the two apart.
 */
const store = useEditorStore

const PRESET: CustomPresetSummary = {
  id: "preset_1",
  name: "Brave Coffee Hamster",
  slotCount: 1,
  type: "style",
  geometry: {
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [],
  },
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const okResponse = (presets: CustomPresetSummary[]) =>
  ({ ok: true, json: async () => ({ presets }) }) as Response

beforeEach(() => {
  store.getState().clearCustomPresets()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("loadCustomPresets", () => {
  it("flags an error instead of reporting an empty account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    store.getState().loadCustomPresets("user_1")
    await flush()

    expect(store.getState().customPresetsError).toBe(true)
    expect(store.getState().customPresets).toEqual([])
    // Still "loaded" so the skeleton stops — the error flag is what the list
    // reads to avoid claiming the account is empty.
    expect(store.getState().customPresetsLoaded).toBe(true)
    expect(store.getState().customPresetsLoading).toBe(false)
  })

  it("flags an error for a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )

    store.getState().loadCustomPresets("user_1")
    await flush()

    expect(store.getState().customPresetsError).toBe(true)
  })

  it("lets a retry through after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(okResponse([PRESET]))
    vi.stubGlobal("fetch", fetchMock)

    store.getState().loadCustomPresets("user_1")
    await flush()
    expect(store.getState().customPresetsError).toBe(true)

    // Same user, same sort: the load dedupe must not swallow the retry.
    store.getState().loadCustomPresets("user_1")
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.getState().customPresetsError).toBe(false)
    expect(store.getState().customPresets).toEqual([PRESET])
  })

  it("keeps a loaded list on a failed re-sort without claiming an error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse([PRESET]))
      .mockRejectedValueOnce(new Error("offline"))
    vi.stubGlobal("fetch", fetchMock)

    store.getState().loadCustomPresets("user_1")
    await flush()

    store.getState().loadCustomPresets("user_1", "oldest")
    await flush()

    expect(store.getState().customPresets).toEqual([PRESET])
    expect(store.getState().customPresetsError).toBe(false)
    expect(store.getState().customPresetsSort).toBe("latest")
  })

  it("clears the error flag when the list is dropped", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    store.getState().loadCustomPresets("user_1")
    await flush()
    expect(store.getState().customPresetsError).toBe(true)

    store.getState().clearCustomPresets()
    expect(store.getState().customPresetsError).toBe(false)
  })
})
