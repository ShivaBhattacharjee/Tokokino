// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  extractBearerToken,
  generatePersonalAccessToken,
  hashPersonalAccessToken,
  isPersonalAccessTokenFormat,
  isTokenExpired,
  patNameSchema,
  PAT_LAST_USED_UPDATE_INTERVAL_MS,
  shouldRefreshLastUsedAt,
  tokenPrefixDisplay,
} from "@/lib/personal-access-tokens"

describe("personal access token primitives", () => {
  it("generates unique tokens in the tk_ format", () => {
    const first = generatePersonalAccessToken()
    const second = generatePersonalAccessToken()

    expect(first).toMatch(/^tk_[A-Za-z0-9_-]{20,}$/)
    expect(second).toMatch(/^tk_[A-Za-z0-9_-]{20,}$/)
    expect(first).not.toBe(second)
    expect(isPersonalAccessTokenFormat(first)).toBe(true)
  })

  it("rejects non-PAT strings as token format", () => {
    expect(isPersonalAccessTokenFormat("")).toBe(false)
    expect(isPersonalAccessTokenFormat("tk_short")).toBe(false)
    expect(isPersonalAccessTokenFormat("Bearer tk_abc")).toBe(false)
    expect(isPersonalAccessTokenFormat("session-token-value")).toBe(false)
    expect(isPersonalAccessTokenFormat("tk_not valid!")).toBe(false)
  })

  it("hashes deterministically and never embeds the plaintext", () => {
    const token = generatePersonalAccessToken()
    const first = hashPersonalAccessToken(token)
    const second = hashPersonalAccessToken(token)

    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).not.toContain(token.slice(3, 10))
    expect(hashPersonalAccessToken(generatePersonalAccessToken())).not.toBe(
      first
    )
  })

  it("derives a non-secret display prefix from the token", () => {
    const token = generatePersonalAccessToken()
    const prefix = tokenPrefixDisplay(token)

    expect(prefix.startsWith("tk_")).toBe(true)
    expect(prefix).toContain("…")
    expect(prefix.length).toBeLessThan(token.length)
  })

  it("extracts bearer tokens case-insensitively", () => {
    const token = generatePersonalAccessToken()
    const headers = new Headers({ Authorization: `Bearer ${token}` })
    expect(extractBearerToken(headers)).toBe(token)

    const lower = new Headers({ authorization: `bearer ${token}` })
    expect(extractBearerToken(lower)).toBe(token)

    expect(extractBearerToken(new Headers())).toBeNull()
    expect(
      extractBearerToken(new Headers({ Authorization: "Basic abc" }))
    ).toBeNull()
  })

  it("detects expired tokens by timestamp", () => {
    expect(isTokenExpired(null)).toBe(false)
    expect(isTokenExpired(undefined)).toBe(false)
    expect(isTokenExpired(new Date(Date.now() + 60_000).toISOString())).toBe(
      false
    )
    expect(isTokenExpired(new Date(Date.now() - 60_000).toISOString())).toBe(
      true
    )
  })

  it("validates token names", () => {
    expect(patNameSchema.safeParse("CI upload script").success).toBe(true)
    expect(patNameSchema.safeParse("  padded  ").data).toBe("padded")
    expect(patNameSchema.safeParse("").success).toBe(false)
    expect(patNameSchema.safeParse("   ").success).toBe(false)
    expect(patNameSchema.safeParse("x".repeat(61)).success).toBe(false)
  })

  it("throttles last-used refreshes to one write per interval", () => {
    const now = 1_000_000_000_000
    expect(PAT_LAST_USED_UPDATE_INTERVAL_MS).toBe(3_600_000)
    expect(shouldRefreshLastUsedAt(null, now)).toBe(true)
    expect(shouldRefreshLastUsedAt(undefined, now)).toBe(true)
    expect(shouldRefreshLastUsedAt("not-a-date", now)).toBe(true)
    expect(
      shouldRefreshLastUsedAt(new Date(now - 30 * 60_000).toISOString(), now)
    ).toBe(false)
    expect(
      shouldRefreshLastUsedAt(
        new Date(now - PAT_LAST_USED_UPDATE_INTERVAL_MS).toISOString(),
        now
      )
    ).toBe(true)
    expect(
      shouldRefreshLastUsedAt(new Date(now - 2 * 3_600_000).toISOString(), now)
    ).toBe(true)
  })
})
