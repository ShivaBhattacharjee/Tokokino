import { describe, expect, it } from "vitest"

import { curlForEndpoint } from "@/app/developers/curl-samples"
import { createDraftBodySchema } from "@/lib/schemas/draft"
import { updatePreferencesBodySchema } from "@/lib/schemas/preferences"
import { createPresetBodySchema } from "@/lib/schemas/preset"

const ENDPOINTS: [string, string][] = [
  ["POST", "/api/share"],
  ["GET", "/api/share"],
  ["DELETE", "/api/share/{id}"],
  ["POST", "/api/share/uploads"],
  ["POST", "/api/share/uploads/{id}/complete"],
  ["GET", "/api/drafts"],
  ["POST", "/api/drafts"],
  ["GET", "/api/drafts/{id}"],
  ["PATCH", "/api/drafts/{id}"],
  ["DELETE", "/api/drafts/{id}"],
  ["GET", "/api/presets"],
  ["POST", "/api/presets"],
  ["GET", "/api/preferences"],
  ["PUT", "/api/preferences"],
  ["GET", "/api/tokens"],
  ["POST", "/api/tokens"],
  ["DELETE", "/api/tokens/{id}"],
  ["POST", "/api/screenshot"],
  ["GET", "/api/tweet"],
  ["GET", "/api/unsplash/search"],
  ["GET", "/api/export/image"],
]

function jsonBody(method: string, path: string): unknown {
  const match = /--data '([\s\S]+)'$/.exec(curlForEndpoint(method, path).trim())
  return match ? JSON.parse(match[1]) : null
}

describe("developer portal cURL samples", () => {
  it.each(ENDPOINTS)("%s %s sends the bearer token", (method, path) => {
    expect(curlForEndpoint(method, path)).toContain(
      'Authorization: Bearer tk_<your-personal-access-token>"'
    )
  })

  it.each(ENDPOINTS)("%s %s carries a parseable body", (method, path) => {
    expect(() => jsonBody(method, path)).not.toThrow()
  })

  it("posts a draft the create schema accepts", () => {
    const parsed = createDraftBodySchema.safeParse(
      jsonBody("POST", "/api/drafts")
    )
    expect(parsed.error?.issues).toBeUndefined()
  })

  it("posts a preset the create schema accepts", () => {
    const parsed = createPresetBodySchema.safeParse(
      jsonBody("POST", "/api/presets")
    )
    expect(parsed.error?.issues).toBeUndefined()
  })

  it("puts preferences the update schema accepts", () => {
    const parsed = updatePreferencesBodySchema.safeParse(
      jsonBody("PUT", "/api/preferences")
    )
    expect(parsed.error?.issues).toBeUndefined()
  })
})
