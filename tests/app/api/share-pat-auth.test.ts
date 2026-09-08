// @vitest-environment node
// Proves protected share endpoints authenticate callers carrying a personal
// access token: the route resolves the user through resolveApiSession (which
// accepts PAT bearers) rather than reading the session cookie directly.
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resolveApiSession: vi.fn(),
  enforceRateLimit: vi.fn(),
  getUserShares: vi.fn(),
  getUserStorageUsage: vi.fn(),
  createShareRecord: vi.fn(),
  uploadShareImage: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  resolveApiSession: mocks.resolveApiSession,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

vi.mock("@/lib/share-db", () => ({
  MAX_USER_SHARE_STORAGE_BYTES: 1024,
  createShareRecord: mocks.createShareRecord,
  deleteAllUserShares: vi.fn(),
  getUserShares: mocks.getUserShares,
  getUserStorageUsage: mocks.getUserStorageUsage,
}))

vi.mock("@/lib/share-storage", () => ({
  MAX_SHARE_IMAGE_BYTES: 4096,
  deleteShareImage: vi.fn(),
  deleteShareImages: vi.fn(),
  uploadShareImage: mocks.uploadShareImage,
  uploadSharePoster: vi.fn(),
}))

const VALID_SHARE_ID = "123e4567-e89b-42d3-a456-426614174000"
const PAT_SESSION = {
  session: { id: "pat:token_1" },
  user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
  authMethod: "pat",
}
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])

function imageRequest(extraHeaders: Record<string, string> = {}) {
  const body = new ArrayBuffer(PNG_BYTES.byteLength)
  new Uint8Array(body).set(PNG_BYTES)
  return new Request("http://localhost:3000/api/share", {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "content-length": String(PNG_BYTES.byteLength),
      Authorization: "Bearer tk_test-token-value-0123456789abcdef",
      ...extraHeaders,
    },
    body,
  })
}

describe("POST /api/share with a personal access token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveApiSession.mockResolvedValue(PAT_SESSION)
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getUserStorageUsage.mockResolvedValue(0)
    mocks.uploadShareImage.mockResolvedValue(undefined)
    mocks.createShareRecord.mockResolvedValue(undefined)
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => VALID_SHARE_ID),
    })
  })

  it("creates a share for the PAT owner without any session cookie", async () => {
    const { POST } = await import("@/app/api/share/route")

    const response = await POST(imageRequest())

    expect(response.status).toBe(200)
    expect(mocks.resolveApiSession).toHaveBeenCalled()
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ user: PAT_SESSION.user })
    )
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user_1" })
    )
  })

  it("still rejects requests with no credential at all", async () => {
    mocks.resolveApiSession.mockResolvedValue(null)
    const { POST } = await import("@/app/api/share/route")

    const response = await POST(imageRequest())

    expect(response.status).toBe(401)
    expect(mocks.createShareRecord).not.toHaveBeenCalled()
  })
})
