// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requestAccountDeletion: vi.fn(),
  first: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  prepare: vi.fn(),
  revokeSession: vi.fn(),
  revokeSessions: vi.fn(),
  retryPendingAccountCleanups: vi.fn(),
  run: vi.fn(),
}))

const statement = {
  bind: vi.fn(() => ({ first: mocks.first, run: mocks.run })),
}

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: {
      getSession: mocks.getSession,
      listSessions: mocks.listSessions,
      revokeSession: mocks.revokeSession,
      revokeSessions: mocks.revokeSessions,
    },
  }),
}))

vi.mock("@/lib/account-management", () => ({
  requestAccountDeletion: mocks.requestAccountDeletion,
  retryPendingAccountCleanups: mocks.retryPendingAccountCleanups,
}))

vi.mock("@/lib/d1", () => ({
  getD1Database: () => ({ prepare: mocks.prepare }),
}))

const SESSION = {
  user: { id: "user_1" },
  session: { id: "session_current" },
}
const OTHER_SESSION = {
  id: "session_other",
  token: "secret-other-token",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  updatedAt: new Date("2026-07-22T10:00:00.000Z"),
}

async function loadRoute() {
  return import("@/app/api/account/route")
}

function request(method: "GET" | "POST" | "DELETE", body?: unknown) {
  return new Request("http://localhost:3000/api/account", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("/api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.listSessions.mockResolvedValue([OTHER_SESSION])
    mocks.first.mockResolvedValue({ location: "Dispur, Assam" })
    mocks.run.mockResolvedValue(undefined)
    mocks.prepare.mockReturnValue(statement)
    mocks.revokeSession.mockResolvedValue({ status: true })
    mocks.revokeSessions.mockResolvedValue({ status: true })
    mocks.requestAccountDeletion.mockResolvedValue({ queued: true })
    mocks.retryPendingAccountCleanups.mockResolvedValue(undefined)
  })

  it("requires a session before listing active devices", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { GET } = await loadRoute()

    const response = await GET(request("GET"))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Sign in required",
    })
    expect(mocks.listSessions).not.toHaveBeenCalled()
  })

  it("lists safe session details without returning session tokens", async () => {
    const { GET } = await loadRoute()

    const response = await GET(request("GET"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      sessions: [
        {
          id: "session_other",
          device: "Chrome on macOS",
          location: "Dispur, Assam",
          lastActive: "2026-07-22T10:00:00.000Z",
          current: false,
        },
      ],
    })
  })

  it("revokes only a session owned by the current user", async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      request("POST", { action: "revoke", sessionId: "session_other" })
    )

    expect(response.status).toBe(200)
    expect(mocks.revokeSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { token: "secret-other-token" },
    })
  })

  it("revokes all sessions for the current account", async () => {
    const { POST } = await loadRoute()

    const response = await POST(request("POST", { action: "revoke-all" }))

    expect(response.status).toBe(200)
    expect(mocks.revokeSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    })
  })

  it("requires the exact deletion confirmation", async () => {
    const { DELETE } = await loadRoute()

    const response = await DELETE(request("DELETE", { confirmation: "delete" }))

    expect(response.status).toBe(400)
    expect(mocks.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it("queues deletion for the authenticated account after confirmation", async () => {
    const { DELETE } = await loadRoute()

    const response = await DELETE(request("DELETE", { confirmation: "DELETE" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "pending",
    })
    expect(mocks.requestAccountDeletion).toHaveBeenCalledWith("user_1")
  })

  it("signs the user out before handing the deletion to the queue", async () => {
    const { DELETE } = await loadRoute()

    await DELETE(request("DELETE", { confirmation: "DELETE" }))

    const revokeOrder = mocks.revokeSessions.mock.invocationCallOrder[0]
    const requestOrder =
      mocks.requestAccountDeletion.mock.invocationCallOrder[0]
    expect(mocks.revokeSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    })
    expect(revokeOrder).toBeLessThan(requestOrder)
  })
})
