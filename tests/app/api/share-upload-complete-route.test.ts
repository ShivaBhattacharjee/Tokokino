// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getShareUploadForUser: vi.fn(),
  getShareUploadParts: vi.fn(),
  isShareUploadExpired: vi.fn(),
  markShareUploadFinalizing: vi.fn(),
  markShareUploadComplete: vi.fn(),
  getShareById: vi.fn(),
  createShareRecord: vi.fn(),
  completeShareMultipartUpload: vi.fn(),
  getShareMultipartObject: vi.fn(),
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
  isShareUploadExpired: mocks.isShareUploadExpired,
  markShareUploadFinalizing: mocks.markShareUploadFinalizing,
  markShareUploadComplete: mocks.markShareUploadComplete,
}))

vi.mock("@/lib/share-db", () => ({
  getShareById: mocks.getShareById,
  createShareRecord: mocks.createShareRecord,
}))

vi.mock("@/lib/share-storage", () => ({
  completeShareMultipartUpload: mocks.completeShareMultipartUpload,
  getShareMultipartObject: mocks.getShareMultipartObject,
}))

const UPLOAD_ID = "123e4567-e89b-42d3-a456-426614174000"
const SESSION = {
  user: { id: "user_1", name: "Shiva", email: "s@example.com" },
}

function upload() {
  return {
    id: UPLOAD_ID,
    userId: SESSION.user.id,
    shareId: UPLOAD_ID,
    objectKey: `shares/${UPLOAD_ID}.mp4`,
    r2UploadId: "r2-upload",
    contentType: "video/mp4",
    sizeBytes: 16,
    status: "finalizing",
    expiresAt: new Date(Date.now() + 60_000),
  }
}

describe("POST /api/share/uploads/[id]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.getShareUploadForUser.mockResolvedValue(upload())
    mocks.getShareUploadParts.mockResolvedValue([
      { partNumber: 1, etag: '"etag-1"', sizeBytes: 16 },
    ])
    mocks.isShareUploadExpired.mockResolvedValue(false)
    mocks.markShareUploadFinalizing.mockResolvedValue(upload())
    mocks.getShareById.mockResolvedValue(null)
    mocks.getShareMultipartObject.mockResolvedValue({
      Metadata: { shareuploadid: UPLOAD_ID },
      ContentLength: 16,
    })
  })

  it("publishes a share exactly once after a lost completion response", async () => {
    const { POST } = await import("@/app/api/share/uploads/[id]/complete/route")

    const response = await POST(
      new Request(
        `http://localhost:3000/api/share/uploads/${UPLOAD_ID}/complete`,
        {
          method: "POST",
        }
      ),
      { params: Promise.resolve({ id: UPLOAD_ID }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: UPLOAD_ID,
      url: `http://localhost:3000/share/${UPLOAD_ID}`,
    })
    expect(mocks.completeShareMultipartUpload).not.toHaveBeenCalled()
    expect(mocks.createShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: UPLOAD_ID,
        key: `shares/${UPLOAD_ID}.mp4`,
        sizeBytes: 16,
        contentType: "video/mp4",
      })
    )
    expect(mocks.markShareUploadComplete).toHaveBeenCalledWith(
      UPLOAD_ID,
      SESSION.user.id
    )
  })

  it("refuses completion while a required part is missing", async () => {
    mocks.getShareUploadParts.mockResolvedValue([])
    const { POST } = await import("@/app/api/share/uploads/[id]/complete/route")

    const response = await POST(
      new Request(
        `http://localhost:3000/api/share/uploads/${UPLOAD_ID}/complete`,
        {
          method: "POST",
        }
      ),
      { params: Promise.resolve({ id: UPLOAD_ID }) }
    )

    expect(response.status).toBe(409)
    expect(mocks.createShareRecord).not.toHaveBeenCalled()
    expect(mocks.completeShareMultipartUpload).not.toHaveBeenCalled()
  })
})
