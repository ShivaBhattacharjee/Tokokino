import { describe, expect, it } from "vitest"

import {
  DRAFT_NAME_MAX_LENGTH,
  countCanvasesInDraftState,
  draftListQuerySchema,
  parseDraftSaveBody,
  resolveDraftType,
  unwrapDraftState,
} from "@/lib/schemas/draft"

describe("draft schema helpers", () => {
  it("accepts legacy draft state when creating a named draft", () => {
    const state = { canvases: [{ id: "canvas-1" }] }

    expect(
      parseDraftSaveBody(
        { name: "  Launch shot  ", state },
        { requireName: true }
      )
    ).toEqual({
      ok: true,
      name: "Launch shot",
      state,
    })
  })

  it("rejects unnamed creates, long names, and empty canvas states", () => {
    expect(
      parseDraftSaveBody(
        { state: { canvases: [{ id: "a" }] } },
        { requireName: true }
      )
    ).toEqual({
      ok: false,
      error: "Name is required",
    })

    expect(
      parseDraftSaveBody(
        {
          name: "x".repeat(DRAFT_NAME_MAX_LENGTH + 1),
          state: { canvases: [{ id: "a" }] },
        },
        { requireName: true }
      )
    ).toEqual({ ok: false, error: "Name is too long" })

    expect(
      parseDraftSaveBody(
        { name: "Empty", state: { canvases: [] } },
        { requireName: true }
      )
    ).toEqual({ ok: false, error: "Invalid draft state" })
  })

  it("unwraps current draft payloads and counts canvases", () => {
    const payload = {
      schemaVersion: 1 as const,
      present: { canvases: [{ id: "a" }, { id: "b" }] },
      ui: { presetTab: "multi" as const, isAnimateMode: true },
    }

    expect(unwrapDraftState(payload)).toEqual({
      present: payload.present,
      ui: payload.ui,
    })
    expect(countCanvasesInDraftState(payload)).toBe(2)
    expect(unwrapDraftState(payload).ui.isAnimateMode).toBe(true)
  })

  it("classifies drafts as animate when mode or clips are present", () => {
    expect(
      resolveDraftType({
        schemaVersion: 1,
        present: { canvases: [{ id: "a", animation: { clips: [] } }] },
        ui: { isAnimateMode: true },
      })
    ).toBe("animate")

    expect(
      resolveDraftType({
        schemaVersion: 1,
        present: {
          canvases: [
            {
              id: "a",
              animation: {
                clips: [{ id: "c1", startMs: 0, durationMs: 500 }],
              },
            },
          ],
        },
        ui: {},
      })
    ).toBe("animate")

    expect(
      resolveDraftType({
        schemaVersion: 1,
        present: { canvases: [{ id: "a" }] },
        ui: {},
      })
    ).toBe("style")
  })

  it("classifies non-animated video canvases as video", () => {
    expect(
      resolveDraftType({
        schemaVersion: 1,
        present: {
          canvases: [
            {
              id: "a",
              screenshot:
                "/api/drafts/media/123e4567-e89b-42d3-a456-426614174000",
            },
          ],
        },
        ui: {},
      })
    ).toBe("video")
  })

  it("keeps an animated video project in animate", () => {
    expect(
      resolveDraftType({
        schemaVersion: 1,
        present: {
          canvases: [
            {
              id: "a",
              screenshot: "https://example.com/demo.webm",
              animation: { clips: [{ id: "c1" }] },
            },
          ],
        },
        ui: {},
      })
    ).toBe("animate")
  })
})

describe("draftListQuerySchema search", () => {
  const parse = (over: Record<string, unknown> = {}) =>
    draftListQuerySchema.parse({ ...over })

  it("passes a trimmed query through", () => {
    expect(parse({ q: "  beach clip " }).q).toBe("beach clip")
  })

  it("treats blank and whitespace-only queries as no search", () => {
    // An empty `q` must become undefined, not "", or the DB layer would build a
    // LIKE '%%' filter and silently paginate a different result set.
    expect(parse({ q: "" }).q).toBeUndefined()
    expect(parse({ q: "   " }).q).toBeUndefined()
    expect(parse().q).toBeUndefined()
  })

  it("rejects an over-long query instead of building a huge LIKE", () => {
    expect(
      parse({ q: "a".repeat(DRAFT_NAME_MAX_LENGTH + 50) }).q
    ).toBeUndefined()
  })

  it("keeps the type filter optional so a search can span every kind", () => {
    expect(parse({ q: "x" }).type).toBeUndefined()
    expect(parse({ q: "x", type: "animate" }).type).toBe("animate")
  })
})
