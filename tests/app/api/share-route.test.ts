// @vitest-environment node
// The share route parses multipart form data (animate poster uploads); jsdom's
// Request does not implement multipart formData() parsing, so run under node.
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
  uploadSharePoster: vi.fn(),
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
  // Generous cap so multipart boundary/header overhead in the animate tests
  // stays under the content-length guard.
  MAX_SHARE_IMAGE_BYTES: 4096,
  deleteShareImage: mocks.deleteShareImage,
  deleteShareImages: mocks.deleteShareImages,
  uploadShareImage: mocks.uploadShareImage,
  uploadSharePoster: mocks.uploadSharePoster,
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
// Minimal ISO-BMFF header: `ftyp` box at offset 4 → sniffed as video/mp4.
const MP4_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00,
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

function bytesToBlob(bytes: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type })
}

/** Animate shares POST multipart: `media` video + optional `poster` still. */
function multipartRequest(
  media: Uint8Array,
  opts: { mediaType?: string; poster?: Uint8Array; posterType?: string } = {}
) {
  const form = new FormData()
  form.append(
    "media",
    bytesToBlob(media, opts.mediaType ?? "video/mp4"),
    "animation.mp4"
  )
  if (opts.poster) {
    form.append(
      "poster",
      bytesToBlob(opts.poster, opts.posterType ?? "image/png"),
      "poster.jpg"
    )
  }
  return new Request("http://localhost:3000/api/share", {
    method: "POST",
    body: form,
  })
}

describe("/api/share", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.deleteShareImage.mockResolvedValue(undefined)
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.getUserStorageUsage.mockResolvedValue(0)
    // clearAllMocks resets call data but not implementations, so re-arm the
    // happy-path resolutions each run (a prior test may leave a rejection).
    mocks.uploadShareImage.mockResolvedValue(undefined)
    mocks.createShareRecord.mockResolvedValue(undefined)
    mocks.uploadSharePoster.mockResolvedValue(
      `shares/${VALID_SHARE_ID}-poster.png`
    )
    mocks.deleteAllUserShares.mockResolvedValue([VALID_SHARE_ID])
    mocks.deleteShareImages.mockResolvedValue(undefined)
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

  it("uploads a poster for an animate multipart share and records its key", async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      multipartRequest(MP4_BYTES, { poster: PNG_BYTES })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: VALID_SHARE_ID,
      type: "animate",
      contentType: "video/mp4",
      posterUrl: `http://localhost:3000/api/share/${VALID_SHARE_ID}/poster`,
    })
    expect(mocks.uploadSharePoster).toHaveBeenCalledWith({
      id: VALID_SHARE_ID,
      image: PNG_BYTES,
      userId: SESSION.user.id,
      contentType: "image/png",
    })
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "animate",
        contentType: "video/mp4",
        posterKey: `shares/${VALID_SHARE_ID}-poster.png`,
      })
    )
  })

  it("creates an animate share without a poster when none is provided", async () => {
    const { POST } = await loadRoute()

    const response = await POST(multipartRequest(MP4_BYTES))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      type: "animate",
      posterUrl: null,
    })
    expect(mocks.uploadSharePoster).not.toHaveBeenCalled()
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ posterKey: null })
    )
  })

  it("ignores a non-image poster payload", async () => {
    const { POST } = await loadRoute()

    // A poster body that isn't PNG/JPEG must be skipped, not uploaded.
    const response = await POST(
      multipartRequest(MP4_BYTES, {
        poster: new TextEncoder().encode("not-an-image"),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ posterUrl: null })
    expect(mocks.uploadSharePoster).not.toHaveBeenCalled()
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ posterKey: null })
    )
  })

  it("still creates the share when poster upload fails", async () => {
    mocks.uploadSharePoster.mockRejectedValue(new Error("r2 down"))
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { POST } = await loadRoute()

    const response = await POST(
      multipartRequest(MP4_BYTES, { poster: PNG_BYTES })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ posterUrl: null })
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({ posterKey: null })
    )
    consoleWarn.mockRestore()
  })

  it("rejects a multipart share with no media part", async () => {
    const { POST } = await loadRoute()

    const form = new FormData()
    form.append("poster", bytesToBlob(PNG_BYTES, "image/png"))
    const response = await POST(
      new Request("http://localhost:3000/api/share", {
        method: "POST",
        body: form,
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Missing file" })
    expect(mocks.uploadShareImage).not.toHaveBeenCalled()
  })

  it("lists authenticated user shares with storage metadata", async () => {
    const shares = [{ id: VALID_SHARE_ID, viewCount: 2, posterUrl: null }]
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

  it("delete-all deletes every share when no type filter is given", async () => {
    const { DELETE } = await loadRoute()

    const response = await DELETE(
      new Request("http://localhost:3000/api/share", { method: "DELETE" })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, deleted: 1 })
    expect(mocks.deleteAllUserShares).toHaveBeenCalledWith(
      SESSION.user.id,
      undefined
    )
  })

  it("delete-all scopes deletion to the active type filter", async () => {
    const { DELETE } = await loadRoute()

    const response = await DELETE(
      new Request("http://localhost:3000/api/share?type=animate", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.deleteAllUserShares).toHaveBeenCalledWith(
      SESSION.user.id,
      "animate"
    )
  })

  it("delete-all ignores an unknown type filter value", async () => {
    const { DELETE } = await loadRoute()

    await DELETE(
      new Request("http://localhost:3000/api/share?type=bogus", {
        method: "DELETE",
      })
    )

    expect(mocks.deleteAllUserShares).toHaveBeenCalledWith(
      SESSION.user.id,
      undefined
    )
  })

  it("delete-all requires a signed-in user", async () => {
    mocks.getSession.mockResolvedValue(null)
    const { DELETE } = await loadRoute()

    const response = await DELETE(
      new Request("http://localhost:3000/api/share", { method: "DELETE" })
    )

    expect(response.status).toBe(401)
    expect(mocks.deleteAllUserShares).not.toHaveBeenCalled()
  })
})
