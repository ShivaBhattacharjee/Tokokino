import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { GET } from "@/app/openapi.json/route"

type Operation = { operationId?: string; responses: Record<string, unknown> }
type PathItem = Record<string, Operation>
type Spec = {
  openapi: string
  info: { title: string; version: string }
  servers: { url: string }[]
  paths: Record<string, PathItem>
  components: { schemas: Record<string, unknown> }
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const

async function loadSpec() {
  const response = GET()
  const spec: Spec = await response.json()
  return { response, spec }
}

function routeFileFor(path: string) {
  const segments = path.replace(/^\//, "").replace(/\{(\w+)\}/g, "[$1]")
  return join(process.cwd(), "app", segments, "route.ts")
}

describe("/openapi.json", () => {
  it("serves JSON that any origin may read", async () => {
    const { response } = await loadSpec()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("declares an OpenAPI 3.1 document for the production server", async () => {
    const { spec } = await loadSpec()

    expect(spec.openapi).toBe("3.1.0")
    expect(spec.info.title).toBe("Tokokino API")
    expect(spec.servers[0].url).toBe("https://tokokino.com")
  })

  it("documents only paths that a real route handler serves", async () => {
    const { spec } = await loadSpec()

    for (const path of Object.keys(spec.paths)) {
      expect(existsSync(routeFileFor(path)), `${path} has no route.ts`).toBe(
        true
      )
    }
  })

  it("documents only methods the route actually exports", async () => {
    const { spec } = await loadSpec()

    for (const [path, item] of Object.entries(spec.paths)) {
      const source = readFileSync(routeFileFor(path), "utf8")
      for (const method of METHODS) {
        if (!(method in item)) continue
        expect(
          source.includes(`function ${method.toUpperCase()}`),
          `${method.toUpperCase()} ${path} is documented but not exported`
        ).toBe(true)
      }
    }
  })

  it("gives every operation an id and at least one response", async () => {
    const { spec } = await loadSpec()

    const ids: string[] = []
    for (const item of Object.values(spec.paths)) {
      for (const method of METHODS) {
        const operation = item[method]
        if (!operation) continue
        expect(operation.operationId).toBeTruthy()
        expect(Object.keys(operation.responses).length).toBeGreaterThan(0)
        ids.push(operation.operationId as string)
      }
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("describes the shared JSON error shape", async () => {
    const { spec } = await loadSpec()

    expect(spec.components.schemas.Error).toMatchObject({
      required: ["error", "code", "message"],
    })
  })
})
