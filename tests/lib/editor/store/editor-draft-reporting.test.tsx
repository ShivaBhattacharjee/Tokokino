import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Local persistence is the only thing standing between a user and losing their
 * work, so every failure in it has to be visible. These cover the three that
 * used to be `console.warn` and nothing else: autosave, restore-on-open, and the
 * stash taken right before an auth redirect navigates the tab away.
 */
const persistence = vi.hoisted(() => ({
  isBrowserIndexedDbAvailable: vi.fn(() => true),
  readEditorDraft: vi.fn(async () => null),
  writeEditorDraft: vi.fn(async () => {}),
  createEditorDraftSnapshot: vi.fn(() => ({ snapshot: true })),
  applyEditorDraft: vi.fn(() => ({})),
  EDITOR_DRAFT_SAVE_DELAY_MS: 250,
}))

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
}))

vi.mock("@/lib/editor/store/draft-persistence", () => persistence)
vi.mock("sonner", () => ({ toast }))

import {
  EditorProvider,
  saveEditorDraftBeforeAuth,
} from "@/lib/editor/store/provider"
import { useEditorStore } from "@/lib/editor/store"

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  persistence.isBrowserIndexedDbAvailable.mockReturnValue(true)
  persistence.readEditorDraft.mockResolvedValue(null)
  persistence.writeEditorDraft.mockResolvedValue(undefined)
  useEditorStore.getState().reset()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("editor draft restore", () => {
  it("tells the user when the stored project could not be read", async () => {
    persistence.readEditorDraft.mockRejectedValueOnce(new Error("corrupt"))

    render(
      <EditorProvider>
        <div />
      </EditorProvider>
    )
    await flush()

    // Without this the editor just opens empty, which reads as "nothing was
    // ever saved" rather than "your project is here but unreadable".
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't restore your last project from this browser"
    )
  })

  it("says nothing when there is simply no stored project", async () => {
    render(
      <EditorProvider>
        <div />
      </EditorProvider>
    )
    await flush()

    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe("editor autosave", () => {
  let padding = 0
  // Fake timers own setTimeout here, so the debounce is driven forward rather
  // than waited on; advanceTimersByTimeAsync also drains the promise chain.
  const editUntilSaved = async () => {
    padding = (padding + 8) % 200
    useEditorStore.getState().setPadding(padding)
    await vi.advanceTimersByTimeAsync(persistence.EDITOR_DRAFT_SAVE_DELAY_MS)
    await vi.advanceTimersByTimeAsync(0)
  }

  /**
   * "Already reported" lives for the lifetime of the module, which is the point
   * — one warning per broken run, not one per edit. Each test therefore opens
   * with a save that works, so it starts from the same healthy state no matter
   * what ran before it.
   */
  const mountWithHealthyAutosave = async () => {
    render(
      <EditorProvider>
        <div />
      </EditorProvider>
    )
    await vi.advanceTimersByTimeAsync(0)
    await editUntilSaved()
    toast.error.mockClear()
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("reports a failing autosave once, not on every keystroke", async () => {
    await mountWithHealthyAutosave()
    persistence.writeEditorDraft.mockRejectedValue(new Error("QuotaExceeded"))

    await editUntilSaved()
    await editUntilSaved()
    await editUntilSaved()

    expect(persistence.writeEditorDraft.mock.calls.length).toBeGreaterThan(1)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save your work in this browser",
      expect.objectContaining({
        description: "Save the project to your account to keep it.",
      })
    )
  })

  it("reports again once saving recovers and breaks a second time", async () => {
    await mountWithHealthyAutosave()
    persistence.writeEditorDraft.mockRejectedValue(new Error("QuotaExceeded"))

    await editUntilSaved()
    expect(toast.error).toHaveBeenCalledTimes(1)

    persistence.writeEditorDraft.mockResolvedValue(undefined)
    await editUntilSaved()
    expect(toast.error).toHaveBeenCalledTimes(1)

    persistence.writeEditorDraft.mockRejectedValue(new Error("QuotaExceeded"))
    await editUntilSaved()
    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it("stays quiet while saving works", async () => {
    render(
      <EditorProvider>
        <div />
      </EditorProvider>
    )
    await vi.advanceTimersByTimeAsync(0)

    await editUntilSaved()

    expect(persistence.writeEditorDraft).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("keeps quiet when a slow earlier save lands after a newer one failed", async () => {
    await mountWithHealthyAutosave()

    // Writes overlap: the debounce can start a second one while the first is
    // still in flight. Here the older write is the one that eventually
    // succeeds, so it must not be read as "saving works again".
    let settleSlowSave = () => {}
    persistence.writeEditorDraft.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settleSlowSave = resolve
      })
    )
    await editUntilSaved()

    persistence.writeEditorDraft.mockRejectedValue(new Error("QuotaExceeded"))
    await editUntilSaved()
    expect(toast.error).toHaveBeenCalledTimes(1)

    settleSlowSave()
    await vi.advanceTimersByTimeAsync(0)

    await editUntilSaved()
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})

describe("saveEditorDraftBeforeAuth", () => {
  it("warns instead of letting the redirect take the work with it", async () => {
    persistence.writeEditorDraft.mockRejectedValueOnce(new Error("nope"))

    // Must not reject: the sign-in has to continue either way.
    await expect(saveEditorDraftBeforeAuth()).resolves.toBeUndefined()

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save your work before signing in",
      expect.objectContaining({
        description: "Export or copy the canvas first if you need to keep it.",
      })
    )
  })

  it("says nothing when the stash succeeds", async () => {
    await saveEditorDraftBeforeAuth()

    expect(persistence.writeEditorDraft).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("is a no-op where IndexedDB is unavailable", async () => {
    persistence.isBrowserIndexedDbAvailable.mockReturnValue(false)

    await saveEditorDraftBeforeAuth()

    expect(persistence.writeEditorDraft).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
