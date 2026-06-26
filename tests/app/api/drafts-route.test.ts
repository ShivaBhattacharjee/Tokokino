import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  enforceRateLimit: vi.fn(),
  countDrafts: vi.fn(),
  createDraft: vi.fn(),
  getUserDraftStorageUsage: vi.fn(),
  listDrafts: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireSession: mocks.requireSession,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

vi.mock("@/lib/draft-db", () => ({
  MAX_USER_DRAFT_STORAGE_BYTES: 1024,
  countDrafts: mocks.countDrafts,
  createDraft: mocks.createDraft,
  getUserDraftStorageUsage: mocks.getUserDraftStorageUsage,
  listDrafts: mocks.listDrafts,
}))

const SESSION = { user: { id: "user_1" } }

async function loadRoute() {
  return import("@/app/api/drafts/route")
}

function request(query: string) {
  return new Request(`http://localhost:3000/api/drafts${query}`)
}

describe("GET /api/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue({ ok: true, session: SESSION })
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.listDrafts.mockResolvedValue([])
    mocks.countDrafts.mockResolvedValue(0)
    mocks.getUserDraftStorageUsage.mockResolvedValue(0)
  })

  it("returns 401 when not signed in", async () => {
    const unauthorized = new Response(null, { status: 401 })
    mocks.requireSession.mockResolvedValue({
      ok: false,
      response: unauthorized,
    })
    const { GET } = await loadRoute()

    const response = await GET(request(""))
    expect(response.status).toBe(401)
    expect(mocks.listDrafts).not.toHaveBeenCalled()
  })

  it("uses defaults when no query params are present", async () => {
    const { GET } = await loadRoute()

    await GET(request(""))

    expect(mocks.listDrafts).toHaveBeenCalledWith("user_1", {
      limit: 9,
      offset: 0,
      sort: "latest",
    })
  })

  it("clamps out-of-range and junk query params instead of passing NaN", async () => {
    const { GET } = await loadRoute()

    await GET(request("?limit=999&offset=-5&sort=oldest"))
    expect(mocks.listDrafts).toHaveBeenLastCalledWith("user_1", {
      limit: 50,
      offset: 0,
      sort: "oldest",
    })

    await GET(request("?limit=abc&offset=xyz&sort=weird"))
    expect(mocks.listDrafts).toHaveBeenLastCalledWith("user_1", {
      limit: 9,
      offset: 0,
      sort: "latest",
    })
  })

  it("computes hasMore from offset, page size, and total", async () => {
    mocks.listDrafts.mockResolvedValue([{ id: "d1" }, { id: "d2" }])
    mocks.countDrafts.mockResolvedValue(10)
    const { GET } = await loadRoute()

    const response = await GET(request("?limit=2&offset=0"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      total: 10,
      hasMore: true,
    })
  })
})
