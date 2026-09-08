// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as PatModule from "@/lib/personal-access-tokens"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  verifyPersonalAccessToken: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: { getSession: mocks.getSession },
  }),
}))

vi.mock("@/lib/personal-access-tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof PatModule>()
  return {
    ...actual,
    verifyPersonalAccessToken: mocks.verifyPersonalAccessToken,
  }
})

const COOKIE_SESSION = {
  session: { id: "session_1" },
  user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
}

describe("resolveApiSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(COOKIE_SESSION)
    mocks.verifyPersonalAccessToken.mockResolvedValue(null)
  })

  it("resolves a valid PAT without touching the session store", async () => {
    mocks.verifyPersonalAccessToken.mockResolvedValue({
      tokenId: "token_1",
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
    })
    const { resolveApiSession } = await import("@/lib/api-auth")

    const session = await resolveApiSession(
      new Request("http://localhost:3000/api/share", {
        headers: { Authorization: "Bearer tk_valid-token-value-0123456789ab" },
      })
    )

    expect(session).toEqual({
      session: { id: "pat:token_1" },
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
      authMethod: "pat",
    })
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it("rejects an unknown PAT even when a session cookie exists", async () => {
    mocks.verifyPersonalAccessToken.mockResolvedValue(null)
    const { resolveApiSession } = await import("@/lib/api-auth")

    const session = await resolveApiSession(
      new Request("http://localhost:3000/api/share", {
        headers: {
          Authorization: "Bearer tk_revoked-token-value-0123456789ab",
          Cookie: "better-auth.session_token=valid",
        },
      })
    )

    expect(session).toBeNull()
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it("falls through to the session for requests without a PAT", async () => {
    const { resolveApiSession } = await import("@/lib/api-auth")

    const session = await resolveApiSession(
      new Request("http://localhost:3000/api/share")
    )

    expect(session).toEqual({ ...COOKIE_SESSION, authMethod: "session" })
    expect(mocks.verifyPersonalAccessToken).not.toHaveBeenCalled()
  })

  it("falls through to the session for a non-PAT bearer token", async () => {
    const { resolveApiSession } = await import("@/lib/api-auth")

    const session = await resolveApiSession(
      new Request("http://localhost:3000/api/share", {
        headers: { Authorization: "Bearer some-session-token" },
      })
    )

    expect(session).toEqual({ ...COOKIE_SESSION, authMethod: "session" })
    expect(mocks.verifyPersonalAccessToken).not.toHaveBeenCalled()
    expect(mocks.getSession).toHaveBeenCalled()
  })

  it("returns null when neither credential is valid", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { resolveApiSession, requireSession } = await import("@/lib/api-auth")

    expect(
      await resolveApiSession(new Request("http://localhost:3000/api/share"))
    ).toBeNull()

    const result = await requireSession(
      new Request("http://localhost:3000/api/share")
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toMatchObject({
        code: "unauthorized",
      })
    }
  })
})
