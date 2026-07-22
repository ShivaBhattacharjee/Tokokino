// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  processAccountDeletion: vi.fn(),
}))

vi.mock("@/lib/account-management", () => ({
  processAccountDeletion: mocks.processAccountDeletion,
}))

vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "test-secret" } }))

import { POST } from "@/app/api/internal/account-deletion/route"

function request(headers: Record<string, string>, body?: unknown) {
  return new Request("http://localhost:3000/api/internal/account-deletion", {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const AUTHED = {
  authorization: "Bearer test-secret",
  "content-type": "application/json",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.processAccountDeletion.mockResolvedValue(undefined)
})

describe("POST /api/internal/account-deletion", () => {
  it("rejects a request with no authorization header", async () => {
    const response = await POST(request({}, { userId: "user_1" }))

    expect(response.status).toBe(401)
    expect(mocks.processAccountDeletion).not.toHaveBeenCalled()
  })

  it("rejects a request with the wrong secret", async () => {
    const response = await POST(
      request(
        { authorization: "Bearer nope", "content-type": "application/json" },
        { userId: "user_1" }
      )
    )

    expect(response.status).toBe(401)
    expect(mocks.processAccountDeletion).not.toHaveBeenCalled()
  })

  it("returns 400 when the userId is missing", async () => {
    const response = await POST(request(AUTHED, {}))

    expect(response.status).toBe(400)
    expect(mocks.processAccountDeletion).not.toHaveBeenCalled()
  })

  it("processes the deletion for an authorized request", async () => {
    const response = await POST(request(AUTHED, { userId: "user_1" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.processAccountDeletion).toHaveBeenCalledWith("user_1")
  })
})
