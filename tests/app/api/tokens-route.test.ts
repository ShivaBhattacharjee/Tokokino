// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as PatModule from "@/lib/personal-access-tokens"

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  enforceRateLimit: vi.fn(),
  listPersonalAccessTokens: vi.fn(),
  countPersonalAccessTokens: vi.fn(),
  createPersonalAccessTokenRecord: vi.fn(),
  deletePersonalAccessToken: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireSession: mocks.requireSession,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

vi.mock("@/lib/personal-access-tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof PatModule>()
  return {
    ...actual,
    listPersonalAccessTokens: mocks.listPersonalAccessTokens,
    countPersonalAccessTokens: mocks.countPersonalAccessTokens,
    createPersonalAccessTokenRecord: mocks.createPersonalAccessTokenRecord,
    deletePersonalAccessToken: mocks.deletePersonalAccessToken,
    generatePersonalAccessToken: () =>
      "tk_test-plaintext-token-value-0123456789",
    hashPersonalAccessToken: () => "test-hash",
    tokenPrefixDisplay: () => "tk_test…6789",
  }
})

const SESSION = {
  session: { id: "session_1" },
  user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
  authMethod: "session",
}

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue({ ok: true, session: SESSION })
    mocks.listPersonalAccessTokens.mockResolvedValue([])
  })

  it("requires authentication", async () => {
    mocks.requireSession.mockResolvedValue({
      ok: false,
      response: new Response("unauthorized", { status: 401 }),
    })
    const { GET } = await import("@/app/api/tokens/route")

    const response = await GET(new Request("http://localhost:3000/api/tokens"))

    expect(response.status).toBe(401)
    expect(mocks.listPersonalAccessTokens).not.toHaveBeenCalled()
  })

  it("lists the caller's tokens", async () => {
    const tokens = [
      {
        id: "token_1",
        name: "CI",
        prefix: "tk_abcd…wxyz",
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        expiresAt: null,
      },
    ]
    mocks.listPersonalAccessTokens.mockResolvedValue(tokens)
    const { GET } = await import("@/app/api/tokens/route")

    const response = await GET(new Request("http://localhost:3000/api/tokens"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ tokens })
    expect(mocks.listPersonalAccessTokens).toHaveBeenCalledWith("user_1")
  })
})

describe("POST /api/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue({ ok: true, session: SESSION })
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.countPersonalAccessTokens.mockResolvedValue(0)
    mocks.createPersonalAccessTokenRecord.mockResolvedValue({
      id: "token_1",
      name: "CI",
      prefix: "tk_test…6789",
      createdAt: "2026-09-07T00:00:00.000Z",
      lastUsedAt: null,
      expiresAt: null,
    })
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "token_1") })
  })

  it("requires authentication", async () => {
    mocks.requireSession.mockResolvedValue({
      ok: false,
      response: new Response("unauthorized", { status: 401 }),
    })
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", { name: "CI" })
    )

    expect(response.status).toBe(401)
    expect(mocks.createPersonalAccessTokenRecord).not.toHaveBeenCalled()
  })

  it("rejects an empty name", async () => {
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", { name: "   " })
    )

    expect(response.status).toBe(400)
    expect(mocks.createPersonalAccessTokenRecord).not.toHaveBeenCalled()
  })

  it("rejects a past expiry", async () => {
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", {
        name: "CI",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.createPersonalAccessTokenRecord).not.toHaveBeenCalled()
  })

  it("enforces the per-user token limit", async () => {
    mocks.countPersonalAccessTokens.mockResolvedValue(20)
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", { name: "CI" })
    )

    expect(response.status).toBe(409)
    expect(mocks.createPersonalAccessTokenRecord).not.toHaveBeenCalled()
  })

  it("returns the plaintext token exactly once with its metadata", async () => {
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", { name: "CI" })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      token: "tk_test-plaintext-token-value-0123456789",
      id: "token_1",
      name: "CI",
      prefix: "tk_test…6789",
      createdAt: "2026-09-07T00:00:00.000Z",
      lastUsedAt: null,
      expiresAt: null,
    })
    expect(mocks.createPersonalAccessTokenRecord).toHaveBeenCalledWith({
      id: "token_1",
      userId: "user_1",
      name: "CI",
      tokenHash: "test-hash",
      prefix: "tk_test…6789",
      expiresAt: null,
    })
  })

  it("accepts a future expiry", async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString()
    const { POST } = await import("@/app/api/tokens/route")

    const response = await POST(
      jsonRequest("http://localhost:3000/api/tokens", {
        name: "CI",
        expiresAt,
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.createPersonalAccessTokenRecord).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: new Date(expiresAt).toISOString() })
    )
  })
})

describe("DELETE /api/tokens/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireSession.mockResolvedValue({ ok: true, session: SESSION })
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.deletePersonalAccessToken.mockResolvedValue(true)
  })

  async function callDelete(id: string) {
    const { DELETE } = await import("@/app/api/tokens/[id]/route")
    return DELETE(
      new Request(`http://localhost:3000/api/tokens/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) }
    )
  }

  it("requires authentication", async () => {
    mocks.requireSession.mockResolvedValue({
      ok: false,
      response: new Response("unauthorized", { status: 401 }),
    })

    const response = await callDelete("token_1")

    expect(response.status).toBe(401)
    expect(mocks.deletePersonalAccessToken).not.toHaveBeenCalled()
  })

  it("revokes an owned token", async () => {
    const response = await callDelete("token_1")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.deletePersonalAccessToken).toHaveBeenCalledWith(
      "token_1",
      "user_1"
    )
  })

  it("returns 404 for a token that is not yours", async () => {
    mocks.deletePersonalAccessToken.mockResolvedValue(false)

    const response = await callDelete("someone-elses-token")

    expect(response.status).toBe(404)
  })
})
