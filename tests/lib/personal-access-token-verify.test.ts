// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  userRow: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  first: vi.fn(),
}))

vi.mock("@/lib/d1", () => ({
  toD1Date: (value: Date) => value.toISOString(),
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(mocks.rows) }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          mocks.updates.push(values)
          return Promise.resolve()
        },
      }),
    }),
  }),
  getD1Database: () => ({
    prepare: () => ({ bind: () => ({ first: mocks.first }) }),
  }),
}))

const TOKEN = "tk_verify-token-value-0123456789ab"

function row(expiresAt: string | null) {
  return {
    id: "token_1",
    userId: "user_1",
    name: "CI",
    prefix: "tk_veri…89ab",
    tokenHash: "hash",
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    expiresAt,
  }
}

describe("verifyPersonalAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = []
    mocks.updates = []
    mocks.first.mockResolvedValue({
      id: "user_1",
      name: "Shiva",
      email: "shiva@example.com",
    })
  })

  it("resolves the owner for a token with no expiry", async () => {
    mocks.rows = [row(null)]
    const { verifyPersonalAccessToken } =
      await import("@/lib/personal-access-tokens")

    await expect(verifyPersonalAccessToken(TOKEN)).resolves.toEqual({
      tokenId: "token_1",
      user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
    })
  })

  it("resolves the owner while the expiry is still in the future", async () => {
    mocks.rows = [row(new Date(Date.now() + 86_400_000).toISOString())]
    const { verifyPersonalAccessToken } =
      await import("@/lib/personal-access-tokens")

    const owner = await verifyPersonalAccessToken(TOKEN)

    expect(owner?.tokenId).toBe("token_1")
  })

  it("rejects an expired token without looking up its user", async () => {
    mocks.rows = [row(new Date(Date.now() - 1_000).toISOString())]
    const { verifyPersonalAccessToken } =
      await import("@/lib/personal-access-tokens")

    await expect(verifyPersonalAccessToken(TOKEN)).resolves.toBeNull()
    expect(mocks.first).not.toHaveBeenCalled()
    expect(mocks.updates).toHaveLength(0)
  })

  it("treats an expiry at the current instant as expired", async () => {
    vi.useFakeTimers()
    const now = new Date("2026-01-01T00:00:00.000Z")
    vi.setSystemTime(now)
    mocks.rows = [row(now.toISOString())]
    const { verifyPersonalAccessToken } =
      await import("@/lib/personal-access-tokens")

    await expect(verifyPersonalAccessToken(TOKEN)).resolves.toBeNull()
    vi.useRealTimers()
  })

  it("refreshes last_used_at for a stale valid token", async () => {
    mocks.rows = [
      {
        ...row(null),
        lastUsedAt: new Date(Date.now() - 7_200_000).toISOString(),
      },
    ]
    const { verifyPersonalAccessToken } =
      await import("@/lib/personal-access-tokens")

    await verifyPersonalAccessToken(TOKEN)

    expect(mocks.updates).toHaveLength(1)
  })
})
