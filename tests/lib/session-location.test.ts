// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  prepare: vi.fn(),
  bind: vi.fn(),
  run: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}))

vi.mock("@/lib/d1", () => ({
  getD1Database: () => ({ prepare: mocks.prepare }),
}))

async function loadModule() {
  return import("@/lib/session-location")
}

describe("sessionLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bind.mockReturnValue({ run: mocks.run })
    mocks.prepare.mockReturnValue({ bind: mocks.bind })
    mocks.run.mockResolvedValue(undefined)
  })

  it("joins the city and region reported by the Cloudflare context", async () => {
    mocks.getCloudflareContext.mockReturnValue({
      cf: { city: "Dispur", region: "Assam", country: "IN" },
    })
    const { sessionLocation } = await loadModule()

    expect(sessionLocation()).toBe("Dispur, Assam")
  })

  it("falls back to the country when no region is reported", async () => {
    mocks.getCloudflareContext.mockReturnValue({
      cf: { city: "Dispur", country: "IN" },
    })
    const { sessionLocation } = await loadModule()

    expect(sessionLocation()).toBe("Dispur, IN")
  })

  it("returns null when the context carries no geo data at all", async () => {
    mocks.getCloudflareContext.mockReturnValue({ cf: undefined })
    const { sessionLocation } = await loadModule()

    expect(sessionLocation()).toBeNull()
  })

  it("returns null when the cf object has no usable fields", async () => {
    mocks.getCloudflareContext.mockReturnValue({ cf: { colo: "BOM" } })
    const { sessionLocation } = await loadModule()

    expect(sessionLocation()).toBeNull()
  })
})

describe("captureSessionLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bind.mockReturnValue({ run: mocks.run })
    mocks.prepare.mockReturnValue({ bind: mocks.bind })
    mocks.run.mockResolvedValue(undefined)
  })

  it("records the location for a newly created session", async () => {
    mocks.getCloudflareContext.mockReturnValue({
      cf: { city: "Dispur", region: "Assam" },
    })
    const { captureSessionLocation } = await loadModule()

    await captureSessionLocation("session_new")

    expect(mocks.bind).toHaveBeenCalledWith(
      "session_new",
      "Dispur, Assam",
      expect.any(String)
    )
    expect(mocks.run).toHaveBeenCalledTimes(1)
  })

  it("writes nothing when there is no location to record", async () => {
    mocks.getCloudflareContext.mockReturnValue({ cf: undefined })
    const { captureSessionLocation } = await loadModule()

    await captureSessionLocation("session_new")

    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it("never lets a failed write reject into the sign-in flow", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    mocks.getCloudflareContext.mockReturnValue({
      cf: { city: "Dispur", region: "Assam" },
    })
    mocks.run.mockRejectedValue(new Error("D1 is unavailable"))
    const { captureSessionLocation } = await loadModule()

    await expect(captureSessionLocation("session_new")).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
