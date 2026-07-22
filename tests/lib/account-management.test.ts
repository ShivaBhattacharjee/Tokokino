// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  markAccountDeletion: vi.fn(),
  getAccountDeletionQueue: vi.fn(),
  clearAccountDeletion: vi.fn(),
  batch: vi.fn(),
  prepare: vi.fn(),
  bind: vi.fn(),
  run: vi.fn(),
  r2send: vi.fn(),
  abort: vi.fn(),
}))

vi.mock("@/lib/account-deletion", () => ({
  markAccountDeletion: mocks.markAccountDeletion,
  getAccountDeletionQueue: mocks.getAccountDeletionQueue,
  clearAccountDeletion: mocks.clearAccountDeletion,
}))

vi.mock("@/lib/d1", () => ({
  getD1Database: () => ({ prepare: mocks.prepare, batch: mocks.batch }),
  // Every ownership lookup returns no rows so the R2 cleanup is a no-op.
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  }),
}))

vi.mock("@/lib/env", () => ({ requireR2Config: () => ({ bucket: "bucket" }) }))
vi.mock("@/lib/r2-client", () => ({
  getR2Client: () => ({ send: mocks.r2send }),
}))
vi.mock("@/lib/share-storage", () => ({
  abortShareMultipartUpload: mocks.abort,
}))
vi.mock("@aws-sdk/client-s3", () => ({ DeleteObjectCommand: class {} }))
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }))
vi.mock("@/lib/db/schema", () => ({
  drafts: { userId: "user_id", stateKey: "state_key", thumbnailKey: "thumb" },
  draftMedia: { userId: "user_id", objectKey: "object_key" },
  shares: { userId: "user_id", objectKey: "object_key", posterKey: "poster" },
  shareUploads: {
    userId: "user_id",
    objectKey: "object_key",
    r2UploadId: "r2_upload_id",
  },
}))

import {
  processAccountDeletion,
  requestAccountDeletion,
} from "@/lib/account-management"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.bind.mockReturnValue({ run: mocks.run })
  mocks.prepare.mockReturnValue({ bind: mocks.bind })
  mocks.run.mockResolvedValue(undefined)
  mocks.batch.mockResolvedValue(undefined)
  mocks.markAccountDeletion.mockResolvedValue(undefined)
  mocks.clearAccountDeletion.mockResolvedValue(undefined)
})

describe("requestAccountDeletion", () => {
  it("flags pending and enqueues the job when the queue binding exists", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    mocks.getAccountDeletionQueue.mockReturnValue({ send })

    const result = await requestAccountDeletion("user_1")

    expect(result).toEqual({ queued: true })
    expect(mocks.markAccountDeletion).toHaveBeenCalledWith("user_1", "pending")
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        requestedAt: expect.any(String),
      })
    )
    // The heavy delete must not run in the request when it is queued.
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(mocks.clearAccountDeletion).not.toHaveBeenCalled()
  })

  it("falls back to inline deletion when the enqueue fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("queue unavailable"))
    mocks.getAccountDeletionQueue.mockReturnValue({ send })

    const result = await requestAccountDeletion("user_1")

    // Must not leave the account flagged with no job to run it.
    expect(result).toEqual({ queued: false })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.clearAccountDeletion).toHaveBeenCalledWith("user_1")
  })

  it("deletes inline when no queue binding is available (local next dev)", async () => {
    mocks.getAccountDeletionQueue.mockReturnValue(null)

    const result = await requestAccountDeletion("user_1")

    expect(result).toEqual({ queued: false })
    expect(mocks.markAccountDeletion).toHaveBeenCalledWith("user_1", "pending")
    expect(mocks.markAccountDeletion).toHaveBeenCalledWith(
      "user_1",
      "processing"
    )
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.clearAccountDeletion).toHaveBeenCalledWith("user_1")
  })
})

describe("processAccountDeletion", () => {
  it("marks processing, runs the delete batch, then clears the flag", async () => {
    await processAccountDeletion("user_1")

    expect(mocks.markAccountDeletion).toHaveBeenCalledWith(
      "user_1",
      "processing"
    )
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.clearAccountDeletion).toHaveBeenCalledWith("user_1")
  })

  it("keeps the flag set if the delete batch fails", async () => {
    mocks.batch.mockRejectedValueOnce(new Error("d1 down"))

    await expect(processAccountDeletion("user_1")).rejects.toThrow("d1 down")

    // Flag stays so the queue retry (or login gate) still sees it as pending.
    expect(mocks.clearAccountDeletion).not.toHaveBeenCalled()
  })
})
