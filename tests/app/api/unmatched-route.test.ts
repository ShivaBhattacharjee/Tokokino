import { describe, expect, it } from "vitest"

import { GET, POST } from "@/app/api/[...unmatched]/route"

function request(path: string) {
  return new Request(`http://localhost:3000${path}`)
}

describe("/api/* catch-all", () => {
  it("answers unknown API paths with JSON, not an HTML error page", async () => {
    const response = GET(request("/api/does-not-exist"))

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toContain("application/json")
  })

  it("names the path that missed and points at the spec", async () => {
    const response = GET(request("/api/nope/deep"))

    await expect(response.json()).resolves.toMatchObject({
      error: "No API endpoint matches /api/nope/deep",
      code: "not_found",
      hint: "Browse the published endpoints in https://tokokino.com/openapi.json",
    })
  })

  it("covers non-GET methods too", async () => {
    const response = POST(request("/api/nope"))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: "not_found" })
  })
})
