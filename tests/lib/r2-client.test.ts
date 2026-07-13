import { describe, expect, it } from "vitest"

import { R2_STREAM_REQUEST_TIMEOUT_MS } from "@/lib/r2-request-timeout"

describe("R2 streaming request timeout", () => {
  it("does not impose a fixed timeout on streaming R2 uploads", () => {
    expect(R2_STREAM_REQUEST_TIMEOUT_MS).toBe(0)
  })
})
