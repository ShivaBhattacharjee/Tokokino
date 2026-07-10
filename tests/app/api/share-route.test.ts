import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createShareRecord: vi.fn(),
  deleteAllUserShares: vi.fn(),
  deleteShareImage: vi.fn(),
  deleteShareImages: vi.fn(),
  enforceRateLimit: vi.fn(),
  getSession: vi.fn(),
  getUserShares: vi.fn(),
  getUserStorageUsage: vi.fn(),
  uploadShareImage: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: { getSession: mocks.getSession },
  }),
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}))

vi.mock("@/lib/share-db", () => ({
  MAX_USER_SHARE_STORAGE_BYTES: 1024,
  createShareRecord: mocks.createShareRecord,
  deleteAllUserShares: mocks.deleteAllUserShares,
  getUserShares: mocks.getUserShares,
  getUserStorageUsage: mocks.getUserStorageUsage,
}))

vi.mock("@/lib/share-storage", () => ({
  MAX_SHARE_IMAGE_BYTES: 128,
  deleteShareImage: mocks.deleteShareImage,
  deleteShareImages: mocks.deleteShareImages,
  uploadShareImage: mocks.uploadShareImage,
}))

const VALID_SHARE_ID = "123e4567-e89b-42d3-a456-426614174000"
const SESSION = {
  user: {
    id: "user_1",
    name: "Shiva",
    email: "shiva@example.com",
  },
}
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])

async function loadRoute() {
  return import("@/app/api/share/route")
}

function imageRequest(body: Uint8Array, contentType = "image/png") {
  const requestBody = new ArrayBuffer(body.byteLength)
  new Uint8Array(requestBody).set(body)

  return new Request("http://localhost:3000/api/share", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "content-length": String(body.byteLength),
    },
    body: requestBody,
  })
}

describe("/api/share", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.deleteShareImage.mockResolvedValue(undefined)
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.getUserStorageUsage.mockResolvedValue(0)
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => VALID_SHARE_ID),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requires a signed-in user for upload", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { POST } = await loadRoute()

    const response = await POST(imageRequest(PNG_BYTES))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Sign in required",
    })
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
  })

  it("rejects unsupported media payloads", async () => {
    const { POST } = await loadRoute()

    // Real WEBP/unsupported body (not a PNG/JPEG/GIF/MP4/WebM magic header).
    const webpLike = new TextEncoder().encode("RIFF....WEBP")
    const response = await POST(imageRequest(webpLike, "image/webp"))

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({
      error: "Share upload must be PNG, JPEG, GIF, MP4, or WebM",
    })
    expect(mocks.uploadShareImage).not.toHaveBeenCalled()
  })

  it("rejects spoofed image bodies", async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      imageRequest(new TextEncoder().encode("<svg></svg>"), "image/png")
    )

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({
      error: "Share upload must be PNG, JPEG, GIF, MP4, or WebM",
    })
    expect(mocks.uploadShareImage).not.toHaveBeenCalled()
  })

  it("uploads a valid image and creates a share record", async () => {
    const { POST } = await loadRoute()

    const response = await POST(imageRequest(PNG_BYTES))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: VALID_SHARE_ID,
      url: `http://localhost:3000/share/${VALID_SHARE_ID}`,
      imageUrl: `http://localhost:3000/api/share/${VALID_SHARE_ID}/image`,
      views: 0,
      reused: false,
      type: "style",
      contentType: "image/png",
    })
    expect(mocks.uploadShareImage).toHaveBeenCalledWith({
      id: VALID_SHARE_ID,
      image: PNG_BYTES,
      userId: SESSION.user.id,
      contentType: "image/png",
      objectKey: `shares/${VALID_SHARE_ID}.png`,
    })
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: VALID_SHARE_ID,
        key: `shares/${VALID_SHARE_ID}.png`,
        imageHash: expect.any(String) as string,
        sizeBytes: PNG_BYTES.byteLength,
        type: "style",
        contentType: "image/png",
        user: SESSION.user,
      })
    )
  })

  it("cleans up uploaded images when record creation fails", async () => {
    mocks.createShareRecord.mockRejectedValue(new Error("db down"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()

    const response = await POST(imageRequest(PNG_BYTES))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Could not prepare share link",
    })
    expect(mocks.deleteShareImage).toHaveBeenCalledWith(
      VALID_SHARE_ID,
      `shares/${VALID_SHARE_ID}.png`,
      "image/png"
    )
    consoleError.mockRestore()
  })

  it("lists authenticated user shares with storage metadata", async () => {
    const shares = [{ id: VALID_SHARE_ID, viewCount: 2 }]
    mocks.getUserShares.mockResolvedValue(shares)
    mocks.getUserStorageUsage.mockResolvedValue(64)
    const { GET } = await loadRoute()

    const response = await GET(new Request("http://localhost:3000/api/share"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      shares,
      storage: { used: 64, limit: 1024 },
    })
  })
})
