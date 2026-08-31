import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { getD1Database } from "@/lib/d1"

export function sessionLocation() {
  // The Workers `cf` object never survives OpenNext's request reconstruction,
  // so it has to come from the Cloudflare context rather than off the Request.
  const cf = getCloudflareContext().cf
  if (!cf) return null
  const parts = [cf.city, cf.region || cf.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

export async function recordSessionLocation(
  sessionId: string,
  location: string
) {
  await getD1Database()
    .prepare(
      "INSERT INTO session_locations (session_id, location, updated_at) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET location = excluded.location, updated_at = excluded.updated_at"
    )
    .bind(sessionId, location, new Date().toISOString())
    .run()
}

export async function captureSessionLocation(sessionId: string) {
  try {
    const location = sessionLocation()
    if (!location) return
    await recordSessionLocation(sessionId, location)
  } catch (error) {
    // A missing location is cosmetic; never let it break sign-in.
    console.error("Could not record session location", error)
  }
}
