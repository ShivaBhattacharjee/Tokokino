import { describe, expect, it } from "vitest"

import { shouldProxyAssetUrl } from "@/lib/editor/export-assets"

describe("shouldProxyAssetUrl", () => {
  it("proxies external http and https assets", () => {
    expect(shouldProxyAssetUrl("https://images.example.com/a.png")).toBe(true)
    expect(shouldProxyAssetUrl("http://images.example.com/a.png")).toBe(true)
  })

  it("does not proxy same-origin or local asset values", () => {
    expect(shouldProxyAssetUrl("http://localhost:3000/logo.png")).toBe(false)
    expect(shouldProxyAssetUrl("/logo.png")).toBe(false)
    expect(shouldProxyAssetUrl("#mask")).toBe(false)
    expect(shouldProxyAssetUrl("data:image/png;base64,abc")).toBe(false)
    expect(shouldProxyAssetUrl("blob:http://localhost:3000/id")).toBe(false)
  })
})
