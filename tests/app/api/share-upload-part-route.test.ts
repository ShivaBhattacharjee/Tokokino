// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getShareUploadForUser: vi.fn(),
  getShareUploadParts: vi.fn(),
  getConfirmedShareUploadBytes: vi.fn(),
  isShareUploadExpired: vi.fn(),
  recordShareUploadPart: vi.fn(),
  uploadShareMultipartPart: vi.fn(),
}))

vi.mock("@/lib/share-upload-server", () => ({
  requireShareUploadUser: async () => ({
    session: (await mocks.getSession()) as unknown,
    response: null,
  }),
}))

vi.mock("@/lib/share-upload-db", () => ({
  getShareUploadForUser: mocks.getShareUploadForUser,
  getShareUploadParts: mocks.getShareUploadParts,
  getConfirmedShareUploadBytes: mocks.getConfirmedShareUploadBytes,
  isShareUploadExpired: mocks.isShareUploadExpired,
  recordShareUploadPart: mocks.recordShareUploadPart,
}))

vi.mock("@/lib/share-storage", () => ({
  SHARE_UPLOAD_PART_BYTES: 16,
  uploadShareMultipartPart: mocks.uploadShareMultipartPart,
}))

const UPLOAD_ID = "123e4567-e89b-42d3-a456-426614174000"
const SESSION = { user: { id: "user_1" } }
const MP4_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00,
])

function upload() {
  return {
    id: UPLOAD_ID,
    userId: SESSION.user.id,
    shareId: UPLOAD_ID,
    objectKey: `shares/${UPLOAD_ID}.mp4`,
    r2UploadId: "r2-upload",
    contentType: "video/mp4",
    sizeBytes: MP4_BYTES.byteLength,
    status: "active",
    expiresAt: new Date(Date.now() + 60_000),
  }
}

function partRequest(range = "bytes 0-15/16") {
  return new Request(
    `http://localhost:3000/api/share/uploads/${UPLOAD_ID}/parts/1`,
    {
      method: "PUT",
      headers: {
        "content-length": String(MP4_BYTES.byteLength),
        "content-range": range,
      },
      body: MP4_BYTES.buffer.slice(0),
    }
  )
}

describe("PUT /api/share/uploads/[id]/parts/[partNumber]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.getShareUploadForUser.mockResolvedValue(upload())
    mocks.getShareUploadParts.mockResolvedValue([])
    mocks.getConfirmedShareUploadBytes.mockResolvedValue(16)
    mocks.isShareUploadExpired.mockResolvedValue(false)
    mocks.uploadShareMultipartPart.mockResolvedValue('"etag-1"')
  })

  it("rejects an incorrect content range before reading R2", async () => {
    const { PUT } =
      await import("@/app/api/share/uploads/[id]/parts/[partNumber]/route")

    const response = await PUT(partRequest("bytes 1-15/16"), {
      params: Promise.resolve({ id: UPLOAD_ID, partNumber: "1" }),
    })

    expect(response.status).toBe(400)
    expect(mocks.uploadShareMultipartPart).not.toHaveBeenCalled()
  })

  it("stores R2's ETag after an exact first video part", async () => {
    const { PUT } =
      await import("@/app/api/share/uploads/[id]/parts/[partNumber]/route")

    const response = await PUT(partRequest(), {
      params: Promise.resolve({ id: UPLOAD_ID, partNumber: "1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.uploadShareMultipartPart).toHaveBeenCalledWith({
      objectKey: `shares/${UPLOAD_ID}.mp4`,
      r2UploadId: "r2-upload",
      partNumber: 1,
      body: MP4_BYTES,
    })
    expect(mocks.recordShareUploadPart).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      partNumber: 1,
      etag: '"etag-1"',
      sizeBytes: 16,
    })
  })

  it("acknowledges an already confirmed part without a second R2 write", async () => {
    mocks.getShareUploadParts.mockResolvedValue([
      { partNumber: 1, etag: '"etag-1"', sizeBytes: 16 },
    ])
    const { PUT } =
      await import("@/app/api/share/uploads/[id]/parts/[partNumber]/route")

    const response = await PUT(partRequest(), {
      params: Promise.resolve({ id: UPLOAD_ID, partNumber: "1" }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ duplicate: true })
    expect(mocks.uploadShareMultipartPart).not.toHaveBeenCalled()
  })
})
