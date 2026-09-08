// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as PatModule from "@/lib/personal-access-tokens"

const mocks = vi.hoisted(() => ({
  requestAccountDeletion: vi.fn(),
  first: vi.fn(),
  all: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  prepare: vi.fn(),
  revokeSession: vi.fn(),
  revokeSessions: vi.fn(),
  retryPendingAccountCleanups: vi.fn(),
  run: vi.fn(),
  getCloudflareContext: vi.fn(),
  verifyPersonalAccessToken: vi.fn(),
}))

const statement = {
  bind: vi.fn(() => ({ first: mocks.first, run: mocks.run, all: mocks.all })),
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

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}))

vi.mock("@/lib/personal-access-tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof PatModule>()
  return {
    ...actual,
    verifyPersonalAccessToken: mocks.verifyPersonalAccessToken,
  }
})

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
    mocks.all.mockResolvedValue({
      results: [{ session_id: "session_other", location: "Dispur, Assam" }],
    })
    mocks.run.mockResolvedValue(undefined)
    mocks.prepare.mockReturnValue(statement)
    mocks.revokeSession.mockResolvedValue({ status: true })
    mocks.revokeSessions.mockResolvedValue({ status: true })
    mocks.requestAccountDeletion.mockResolvedValue({ queued: true })
    mocks.retryPendingAccountCleanups.mockResolvedValue(undefined)
    mocks.getCloudflareContext.mockReturnValue({
      cf: { city: "Dispur", region: "Assam", country: "IN" },
    })
    mocks.verifyPersonalAccessToken.mockResolvedValue(null)
  })

  it("requires a session before listing active devices", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { GET } = await loadRoute()

    const response = await GET(request("GET"))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: "Sign in required",
      code: "unauthorized",
    })
    expect(mocks.listSessions).not.toHaveBeenCalled()
  })

  it("rejects personal access tokens for session listing", async () => {
    mocks.verifyPersonalAccessToken.mockResolvedValue({
      tokenId: "token_1",
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
    })
    const { GET } = await loadRoute()

    const response = await GET(
      new Request("http://localhost:3000/api/account", {
        headers: {
          Authorization: "Bearer tk_test-token-value-0123456789abcdef",
        },
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: "forbidden",
    })
    expect(mocks.listSessions).not.toHaveBeenCalled()
  })

  it("rejects personal access tokens for session revocation", async () => {
    mocks.verifyPersonalAccessToken.mockResolvedValue({
      tokenId: "token_1",
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
    })
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost:3000/api/account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer tk_test-token-value-0123456789abcdef",
        },
        body: JSON.stringify({ action: "revoke-all" }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.revokeSessions).not.toHaveBeenCalled()
  })

  it("rejects personal access tokens for account deletion", async () => {
    mocks.verifyPersonalAccessToken.mockResolvedValue({
      tokenId: "token_1",
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
    })
    const { DELETE } = await loadRoute()

    const response = await DELETE(
      new Request("http://localhost:3000/api/account", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer tk_test-token-value-0123456789abcdef",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.requestAccountDeletion).not.toHaveBeenCalled()
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

  it("records the current session location from the Cloudflare context", async () => {
    const { GET } = await loadRoute()

    await GET(request("GET"))

    expect(statement.bind).toHaveBeenCalledWith(
      "session_current",
      "Dispur, Assam",
      expect.any(String)
    )
  })

  it("skips the location write when the Cloudflare context has no geo data", async () => {
    mocks.getCloudflareContext.mockReturnValue({ cf: undefined })
    const { GET } = await loadRoute()

    const response = await GET(request("GET"))

    expect(response.status).toBe(200)
    expect(statement.bind).not.toHaveBeenCalledWith(
      "session_current",
      expect.any(String),
      expect.any(String)
    )
  })

  it("revokes only a session owned by the current user", async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      request("POST", { action: "revoke", sessionId: "session_other" })
    )

    expect(response.status).toBe(200)
    expect(mocks.revokeSession).toHaveBeenCalledWith({
      headers: expect.any(Headers) as unknown,
      body: { token: "secret-other-token" },
    })
  })

  it("revokes all sessions for the current account", async () => {
    const { POST } = await loadRoute()

    const response = await POST(request("POST", { action: "revoke-all" }))

    expect(response.status).toBe(200)
    expect(mocks.revokeSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers) as unknown,
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
      headers: expect.any(Headers) as unknown,
    })
    expect(revokeOrder).toBeLessThan(requestOrder)
  })
})
