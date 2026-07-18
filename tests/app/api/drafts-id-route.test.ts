import { beforeEach, describe, expect, it, vi } from "vitest"

import { DRAFT_NAME_MAX_LENGTH } from "@/lib/schemas/draft"

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  renameDraft: vi.fn(),
  // The route module imports these at the top level; they are unused by PATCH
  // but must exist so importing the module doesn't blow up.
  deleteDraft: vi.fn(),
  getDraft: vi.fn(),
  getDraftMetadata: vi.fn(),
  getUserDraftStorageUsage: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraftState: vi.fn(),
  deleteDraftThumbnail: vi.fn(),
  deleteDraftMediaObject: vi.fn(),
  attachDraftMedia: vi.fn(),
  deleteDraftMedia: vi.fn(),
  getDraftMediaForDraft: vi.fn(),
  getDraftMediaForSave: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireSession: mocks.requireSession,
}))

vi.mock("@/lib/draft-db", () => ({
  MAX_USER_DRAFT_STORAGE_BYTES: 1024,
  deleteDraft: mocks.deleteDraft,
  getDraft: mocks.getDraft,
  getDraftMetadata: mocks.getDraftMetadata,
  getUserDraftStorageUsage: mocks.getUserDraftStorageUsage,
  renameDraft: mocks.renameDraft,
  updateDraft: mocks.updateDraft,
}))

vi.mock("@/lib/draft-storage", () => ({
  deleteDraftState: mocks.deleteDraftState,
  deleteDraftThumbnail: mocks.deleteDraftThumbnail,
  deleteDraftMediaObject: mocks.deleteDraftMediaObject,
}))

vi.mock("@/lib/draft-media-db", () => ({
  attachDraftMedia: mocks.attachDraftMedia,
  deleteDraftMedia: mocks.deleteDraftMedia,
  getDraftMediaForDraft: mocks.getDraftMediaForDraft,
  getDraftMediaForSave: mocks.getDraftMediaForSave,
}))

const SESSION = { user: { id: "user_1" } }

async function loadRoute() {
  return import("@/app/api/drafts/[id]/route")
}

function patchRequest(id: string, body: unknown, { raw = false } = {}) {
  return {
    request: new Request(`http://localhost:3000/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  }
}

describe("PATCH /api/drafts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue({ ok: true, session: SESSION })
    mocks.renameDraft.mockResolvedValue({
      id: "draft_1",
      name: "New name",
    })
  })

  it("returns 401 when not signed in", async () => {
    const unauthorized = new Response(null, { status: 401 })
    mocks.requireSession.mockResolvedValue({
      ok: false,
      response: unauthorized,
    })
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", { name: "New name" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(401)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("renames the draft and returns the trimmed name", async () => {
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", {
      name: "  Fresh Title  ",
    })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: { id: "draft_1", name: "Fresh Title" },
    })
    expect(mocks.renameDraft).toHaveBeenCalledWith({
      id: "draft_1",
      userId: "user_1",
      name: "Fresh Title",
    })
  })

  it("rejects an empty or whitespace-only name with 400", async () => {
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", { name: "   " })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(400)
    const body: { error?: string } = await response.json()
    expect(body.error).toMatch(/required/i)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("rejects a missing name field with 400", async () => {
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", {})
    const response = await PATCH(request, { params })

    expect(response.status).toBe(400)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("rejects a non-string name with 400", async () => {
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", { name: 42 })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(400)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("rejects a name longer than the max length with 400", async () => {
    const { PATCH } = await loadRoute()

    const tooLong = "x".repeat(DRAFT_NAME_MAX_LENGTH + 1)
    const { request, params } = patchRequest("draft_1", { name: tooLong })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(400)
    const body: { error?: string } = await response.json()
    expect(body.error).toMatch(/characters/i)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("accepts a name exactly at the max length", async () => {
    const { PATCH } = await loadRoute()

    const exact = "y".repeat(DRAFT_NAME_MAX_LENGTH)
    const { request, params } = patchRequest("draft_1", { name: exact })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(200)
    expect(mocks.renameDraft).toHaveBeenCalledWith({
      id: "draft_1",
      userId: "user_1",
      name: exact,
    })
  })

  it("returns 404 when the draft does not exist or isn't owned by the user", async () => {
    mocks.renameDraft.mockResolvedValue(null)
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("missing", { name: "New name" })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(404)
    const body: { error?: string } = await response.json()
    expect(body.error).toMatch(/not found/i)
  })

  it("rejects a malformed JSON body with 400", async () => {
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", "{ not json", {
      raw: true,
    })
    const response = await PATCH(request, { params })

    expect(response.status).toBe(400)
    expect(mocks.renameDraft).not.toHaveBeenCalled()
  })

  it("scopes the rename to the authenticated user", async () => {
    mocks.requireSession.mockResolvedValue({
      ok: true,
      session: { user: { id: "user_2" } },
    })
    const { PATCH } = await loadRoute()

    const { request, params } = patchRequest("draft_1", { name: "Renamed" })
    await PATCH(request, { params })

    expect(mocks.renameDraft).toHaveBeenCalledWith({
      id: "draft_1",
      userId: "user_2",
      name: "Renamed",
    })
  })
})
