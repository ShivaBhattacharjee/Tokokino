// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  bind: vi.fn(),
  run: vi.fn(),
  first: vi.fn(),
  all: vi.fn(),
  getCloudflareContext: vi.fn(),
}))

vi.mock("@/lib/d1", () => ({
  getD1Database: () => ({ prepare: mocks.prepare }),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}))

import {
  clearAccountDeletion,
  getAccountDeletionQueue,
  isAccountDeletionPending,
  listStalePendingDeletions,
  markAccountDeletion,
} from "@/lib/account-deletion"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.bind.mockReturnValue({
    run: mocks.run,
    first: mocks.first,
    all: mocks.all,
  })
  mocks.prepare.mockReturnValue({ bind: mocks.bind })
  mocks.run.mockResolvedValue(undefined)
})

describe("account-deletion flag store", () => {
  describe("markAccountDeletion", () => {
    it("upserts the flag with the given status and user", async () => {
      await markAccountDeletion("user_1", "pending")

      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO account_deletions")
      )
      const [userId, status] = mocks.bind.mock.calls[0]
      expect(userId).toBe("user_1")
      expect(status).toBe("pending")
    })

    it("does not overwrite requested_at on status transitions", async () => {
      await markAccountDeletion("user_1", "processing")

      // ON CONFLICT updates status + updated_at only — requested_at is untouched.
      const sql = String(mocks.prepare.mock.calls[0][0])
      expect(sql).toContain(
        "ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at"
      )
      expect(sql).not.toContain("requested_at = excluded.requested_at")
    })
  })

  describe("isAccountDeletionPending", () => {
    it("returns true when a flag row exists", async () => {
      mocks.first.mockResolvedValue({ present: 1 })

      expect(await isAccountDeletionPending("user_1")).toBe(true)
      expect(mocks.bind).toHaveBeenCalledWith("user_1")
      // A terminal "failed" flag must not count as pending.
      const sql = String(mocks.prepare.mock.calls[0][0])
      expect(sql).toContain("status IN ('pending', 'processing')")
    })

    it("returns false when no flag row exists", async () => {
      mocks.first.mockResolvedValue(null)

      expect(await isAccountDeletionPending("user_1")).toBe(false)
    })
  })

  describe("clearAccountDeletion", () => {
    it("deletes the flag row for the user", async () => {
      await clearAccountDeletion("user_1")

      expect(mocks.prepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM account_deletions")
      )
      expect(mocks.bind).toHaveBeenCalledWith("user_1")
    })
  })

  describe("listStalePendingDeletions", () => {
    it("returns the stale flags with their request time, excluding failed", async () => {
      mocks.all.mockResolvedValue({
        results: [
          { user_id: "user_1", requested_at: "2026-07-22T00:00:00.000Z" },
          { user_id: "user_2", requested_at: "2026-07-22T01:00:00.000Z" },
        ],
      })

      const stale = await listStalePendingDeletions()

      expect(stale).toEqual([
        { userId: "user_1", requestedAt: "2026-07-22T00:00:00.000Z" },
        { userId: "user_2", requestedAt: "2026-07-22T01:00:00.000Z" },
      ])
      const sql = String(mocks.prepare.mock.calls[0][0])
      expect(sql).toContain("status IN ('pending', 'processing')")
      expect(sql).toContain("updated_at <= ?")
    })

    it("returns an empty array when nothing is stale", async () => {
      mocks.all.mockResolvedValue({ results: [] })

      expect(await listStalePendingDeletions()).toEqual([])
    })
  })

  describe("getAccountDeletionQueue", () => {
    it("returns the binding when it exposes send()", () => {
      const send = vi.fn()
      mocks.getCloudflareContext.mockReturnValue({
        env: { ACCOUNT_DELETION_QUEUE: { send } },
      })

      expect(getAccountDeletionQueue()).toEqual({ send })
    })

    it("returns null when the binding is missing (local next dev)", () => {
      mocks.getCloudflareContext.mockReturnValue({ env: {} })

      expect(getAccountDeletionQueue()).toBeNull()
    })

    it("returns null when the binding lacks a send() method", () => {
      mocks.getCloudflareContext.mockReturnValue({
        env: { ACCOUNT_DELETION_QUEUE: {} },
      })

      expect(getAccountDeletionQueue()).toBeNull()
    })

    it("returns null when there is no Cloudflare context", () => {
      mocks.getCloudflareContext.mockImplementation(() => {
        throw new Error("no context")
      })

      expect(getAccountDeletionQueue()).toBeNull()
    })
  })
})
