import { describe, expect, it } from "vitest"

import { apiError, apiErrorBody } from "@/lib/api-error"

describe("apiErrorBody", () => {
  it("repeats the message under `error` so string-reading clients keep working", () => {
    const body = apiErrorBody({ code: "not_found", message: "Draft not found" })

    expect(body.error).toBe("Draft not found")
    expect(body.message).toBe("Draft not found")
  })

  it("supplies a default resolution hint per code", () => {
    expect(apiErrorBody({ code: "unauthorized", message: "x" }).hint).toContain(
      "/login"
    )
    expect(apiErrorBody({ code: "rate_limited", message: "x" }).hint).toContain(
      "retry"
    )
  })

  it("prefers an explicit hint over the default", () => {
    const body = apiErrorBody({
      code: "invalid_request",
      message: "Bad body",
      hint: "Send JSON.",
    })

    expect(body.hint).toBe("Send JSON.")
  })

  it("links the published error documentation", () => {
    expect(apiErrorBody({ code: "forbidden", message: "x" }).docs).toBe(
      "https://tokokino.com/developers#errors"
    )
  })
})

describe("apiError", () => {
  it("returns the status and body together", async () => {
    const response = apiError({
      status: 413,
      code: "payload_too_large",
      message: "File is too large",
    })

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      error: "File is too large",
      code: "payload_too_large",
    })
  })
})
