import { describe, expect, it } from "vitest"

import { GET } from "@/app/.well-known/ai-catalog.json/route"

const URN_PATTERN = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/

type CatalogEntry = {
  identifier: string
  displayName: string
  type: string
  url?: string
  data?: object
  representativeQueries: string[]
}

type Catalog = {
  specVersion: string
  host: { displayName: string }
  entries: CatalogEntry[]
}

async function loadCatalog() {
  const response = GET()
  const catalog: Catalog = await response.json()
  return { response, catalog }
}

describe("/.well-known/ai-catalog.json", () => {
  it("serves JSON that any origin may read", async () => {
    const { response } = await loadCatalog()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("declares the spec version, host, and a non-empty entry list", async () => {
    const { catalog } = await loadCatalog()

    expect(catalog.specVersion).toBe("1.0")
    expect(catalog.host.displayName).toBe("Tokokino")
    expect(catalog.entries.length).toBeGreaterThan(0)
  })

  it("gives every entry a domain-anchored URN, display name, and media type", async () => {
    const { catalog } = await loadCatalog()

    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(URN_PATTERN)
      expect(entry.identifier.startsWith("urn:air:tokokino.com:")).toBe(true)
      expect(entry.displayName).toBeTruthy()
      expect(entry.type).toMatch(/^[a-z]+\/[a-zA-Z0-9.+-]+$/)
    }
  })

  it("carries exactly one of url or data per entry", async () => {
    const { catalog } = await loadCatalog()

    for (const entry of catalog.entries) {
      expect("url" in entry).not.toBe("data" in entry)
    }
  })

  it("carries 2-5 representative queries per entry so registries can embed them", async () => {
    const { catalog } = await loadCatalog()

    for (const entry of catalog.entries) {
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2)
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5)
    }
  })

  it("uses identifiers that are unique across the catalog", async () => {
    const { catalog } = await loadCatalog()

    const ids = catalog.entries.map(
      (entry: { identifier: string }) => entry.identifier
    )
    expect(new Set(ids).size).toBe(ids.length)
  })
})
