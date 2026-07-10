// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getSession: vi.fn(),
  fetch: vi.fn(),
  env: { FEEDBACK_DISCORD_WEBHOOK_URL: undefined as string | undefined },
}))

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { getSession: mocks.getSession } }),
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: () => "1.2.3.4",
}))

vi.mock("@/lib/env", () => ({
  get env() {
    return mocks.env
  },
}))

const WEBHOOK_URL = "https://discord.com/api/webhooks/1/abc"
const SESSION = {
  user: { id: "user_1", name: "Shiva", email: "shiva@example.com" },
}

async function loadRoute() {
  return import("@/app/api/feedback/route")
}

function feedbackRequest(body: unknown) {
  return new Request("http://localhost:3000/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

type DiscordEmbed = {
  title: string
  description: string
  color: number
  fields: { name: string; value: string }[]
}

/** The JSON payload posted to the Discord webhook in the most recent call. */
function lastWebhookPayload(): { embeds: DiscordEmbed[] } {
  const call = mocks.fetch.mock.calls.at(-1)
  return JSON.parse((call?.[1] as RequestInit).body as string) as {
    embeds: DiscordEmbed[]
  }
}

describe("/api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.enforceRateLimit.mockResolvedValue(null)
    mocks.getSession.mockResolvedValue(null)
    mocks.env.FEEDBACK_DISCORD_WEBHOOK_URL = WEBHOOK_URL
    mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", mocks.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the 429 response when rate limited", async () => {
    const limited = new Response("nope", { status: 429 })
    mocks.enforceRateLimit.mockResolvedValue(limited)
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 5 }))

    expect(response.status).toBe(429)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("rejects a submission with neither a rating nor a message", async () => {
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({}))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid feedback.",
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range rating", async () => {
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 9 }))

    expect(response.status).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON", async () => {
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("accepts a message-only submission and posts it to Discord", async () => {
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ message: "  great app  " }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith(
      WEBHOOK_URL,
      expect.objectContaining({ method: "POST" })
    )
    const payload = lastWebhookPayload()
    // Message is trimmed; with no rating it uses the neutral title/colour.
    expect(payload.embeds[0].description).toBe("great app")
    expect(payload.embeds[0].title).toBe("New feedback")
    expect(payload.embeds[0].fields[0].value).toBe("Anonymous")
  })

  it("maps the 1-based rating to the matching emoji and colour", async () => {
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 1, message: "bad" }))

    expect(response.status).toBe(200)
    const payload = lastWebhookPayload()
    expect(payload.embeds[0].title).toBe("🤬  Angry")
    expect(payload.embeds[0].color).toBe(0xef4444)
  })

  it("uses a placeholder when a rating is sent without a message", async () => {
    const { POST } = await loadRoute()

    await POST(feedbackRequest({ rating: 5 }))

    const payload = lastWebhookPayload()
    expect(payload.embeds[0].title).toBe("😍  Love it")
    expect(payload.embeds[0].description).toBe("_(no message)_")
  })

  it("attaches the signed-in user's identity when available", async () => {
    mocks.getSession.mockResolvedValue(SESSION)
    const { POST } = await loadRoute()

    await POST(feedbackRequest({ rating: 4, message: "nice" }))

    const payload = lastWebhookPayload()
    expect(payload.embeds[0].fields[0].value).toBe("Shiva · shiva@example.com")
  })

  it("stays anonymous when the session lookup throws", async () => {
    mocks.getSession.mockRejectedValue(new Error("auth down"))
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 3 }))

    expect(response.status).toBe(200)
    expect(lastWebhookPayload().embeds[0].fields[0].value).toBe("Anonymous")
  })

  it("accepts submissions but skips Discord when no webhook is configured", async () => {
    mocks.env.FEEDBACK_DISCORD_WEBHOOK_URL = undefined
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 5, message: "hi" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.fetch).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("still returns ok when the Discord post fails", async () => {
    mocks.fetch.mockRejectedValue(new Error("network"))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadRoute()

    const response = await POST(feedbackRequest({ rating: 2, message: "meh" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    error.mockRestore()
  })
})
