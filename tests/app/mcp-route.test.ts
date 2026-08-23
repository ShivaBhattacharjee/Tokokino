import { describe, expect, it } from "vitest"

import { GET, POST } from "@/app/mcp/route"

describe("/mcp", () => {
  it("answers 503 with Retry-After rather than 404, since the endpoint is announced but not live", () => {
    const response = GET()

    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("86400")
    expect(response.headers.get("Content-Type")).toBe("application/json")
  })

  it("says the server is coming soon and points at what works today", async () => {
    const response = POST()

    await expect(response.json()).resolves.toMatchObject({
      status: "coming_soon",
      serverCard: "https://tokokino.com/.well-known/mcp/server-card.json",
      docs: "https://tokokino.com/developers",
    })
  })
})
