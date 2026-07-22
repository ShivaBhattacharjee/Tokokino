// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  reconcileStaleAccountDeletions: vi.fn(),
  retryPendingAccountCleanups: vi.fn(),
}))

vi.mock("@/lib/account-management", () => ({
  reconcileStaleAccountDeletions: mocks.reconcileStaleAccountDeletions,
  retryPendingAccountCleanups: mocks.retryPendingAccountCleanups,
}))

vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "test-secret" } }))

import { POST } from "@/app/api/internal/account-deletion/reconcile/route"

function request(headers: Record<string, string>) {
  return new Request(
    "http://localhost:3000/api/internal/account-deletion/reconcile",
    { method: "POST", headers }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reconcileStaleAccountDeletions.mockResolvedValue({
    processed: 2,
    failed: 0,
    abandoned: 0,
  })
  mocks.retryPendingAccountCleanups.mockResolvedValue(undefined)
})

describe("POST /api/internal/account-deletion/reconcile", () => {
  it("rejects a request without the shared secret", async () => {
    const response = await POST(request({}))

    expect(response.status).toBe(401)
    expect(mocks.reconcileStaleAccountDeletions).not.toHaveBeenCalled()
  })

  it("rejects a request with the wrong secret", async () => {
    const response = await POST(request({ authorization: "Bearer nope" }))

    expect(response.status).toBe(401)
    expect(mocks.reconcileStaleAccountDeletions).not.toHaveBeenCalled()
  })

  it("runs the reconciler and returns its counts for an authorized request", async () => {
    const response = await POST(
      request({ authorization: "Bearer test-secret" })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      processed: 2,
      failed: 0,
      abandoned: 0,
    })
    expect(mocks.reconcileStaleAccountDeletions).toHaveBeenCalledTimes(1)
    // The cron also drains the R2 cleanup outbox so a deleted user's orphaned
    // objects don't depend on other account traffic to be removed.
    expect(mocks.retryPendingAccountCleanups).toHaveBeenCalledTimes(1)
  })
})
