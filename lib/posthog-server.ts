import { getCloudflareContext } from "@opennextjs/cloudflare"
import { PostHog } from "posthog-node"

type ServerEvent = {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}

let client: PostHog | null = null
let warnedMissingToken = false

/**
 * Memoised per isolate. Building a client per request also built a fresh HTTP
 * agent and event queue for a single event, which is pure overhead on a Worker.
 *
 * Construction stays lazy because `process.env` is only populated once OpenNext
 * has handed the Worker env over — a module-scope read sees nothing.
 */
function getClient(): PostHog | null {
  if (client) return client

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) {
    if (process.env.NODE_ENV === "development" && !warnedMissingToken) {
      warnedMissingToken = true
      console.error(
        "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing — server-side analytics events are being dropped."
      )
    }
    return null
  }

  client = new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    // One event per request, so batching only delays delivery past the point
    // where `waitUntil` is still holding the isolate open.
    flushAt: 1,
    flushInterval: 0,
  })
  return client
}

/**
 * Capture without making the user wait for it.
 *
 * Awaiting the flush put a round trip to PostHog on the critical path of every
 * instrumented response. `waitUntil` keeps the isolate alive for the send after
 * the response has already gone out; analytics failures never surface to the
 * caller.
 */
export function captureServerEvent({
  distinctId,
  event,
  properties,
}: ServerEvent): void {
  const posthog = getClient()
  if (!posthog) return

  try {
    posthog.capture({ distinctId, event, properties: properties ?? {} })
  } catch (error) {
    console.warn("[posthog] capture failed", error)
    return
  }

  const flushed = posthog.flush().catch((error: unknown) => {
    console.warn("[posthog] flush failed", error)
  })

  try {
    getCloudflareContext().ctx.waitUntil(flushed)
  } catch {
    // Outside a Cloudflare request context (build-time, tests) there is nothing
    // holding the process open, so fall back to letting the promise settle.
    void flushed
  }
}
