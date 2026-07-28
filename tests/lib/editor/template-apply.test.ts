import { beforeEach, describe, expect, it } from "vitest"

import {
  applyTemplate,
  TemplateApplyError,
  templateApplyErrorMessage,
  templateApplyReplacedState,
} from "@/lib/editor/templates/apply"
import { useEditorStore } from "@/lib/editor/store"
import { createCanvas, DEFAULT_STATE } from "@/lib/editor/store/defaults"
import type { AnimationClip, CanvasState } from "@/lib/editor/state-types"
import type { Template } from "@/lib/editor/templates"
import { DRAFT_SCHEMA_VERSION } from "@/lib/schemas/draft"

const clip = (id: string): AnimationClip => ({
  id,
  startMs: 0,
  durationMs: 1200,
  target: { scope: "all" },
  effects: [],
})

function makeTemplate(
  overrides: {
    category?: Template["category"]
    canvas?: Partial<CanvasState>
    isAnimateMode?: boolean
    /** Replaces the whole payload — for the malformed cases. */
    state?: unknown
  } = {}
): Template {
  const canvas = { ...createCanvas("tpl-canvas"), ...overrides.canvas }
  return {
    id: "product-reveal",
    name: "Product Reveal",
    category: overrides.category ?? "animation",
    thumbnail: "https://assets.example.com/templates/product-reveal.jpg",
    state: (overrides.state ?? {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      present: {
        ...DEFAULT_STATE,
        canvases: [canvas],
        activeCanvasId: canvas.id,
      },
      ui: { isAnimateMode: overrides.isAnimateMode ?? true },
    }) as Template["state"],
  }
}

const animated = () =>
  makeTemplate({
    canvas: {
      animation: { durationMs: 4000, clips: [clip("a"), clip("b")] },
    },
  })

function activeCanvas() {
  const { present } = useEditorStore.getState()
  return present.canvases.find((c) => c.id === present.activeCanvasId)
}

beforeEach(() => {
  useEditorStore.getState().reset()
})

describe("applyTemplate", () => {
  it("applies an animation template and keeps its clips", () => {
    applyTemplate(animated())

    expect(activeCanvas()?.animation?.clips).toHaveLength(2)
    expect(useEditorStore.getState().isAnimateMode).toBe(true)
  })

  it("applies an image template without touching the timeline", () => {
    applyTemplate(
      makeTemplate({
        category: "image",
        isAnimateMode: false,
        canvas: { padding: 96 },
      })
    )

    expect(activeCanvas()?.padding).toBe(96)
    expect(activeCanvas()?.animation?.clips).toHaveLength(0)
  })

  it("refuses an animation template with no clips, leaving the project alone", () => {
    useEditorStore.getState().setPadding(37)

    expect(() => applyTemplate(makeTemplate())).toThrow(TemplateApplyError)
    // Pre-flight failure: the user's canvas must survive untouched.
    expect(activeCanvas()?.padding).toBe(37)
  })

  it("refuses an animation template that never enters Animate mode", () => {
    const template = makeTemplate({
      isAnimateMode: false,
      canvas: { animation: { durationMs: 4000, clips: [clip("a")] } },
    })

    expect(() => applyTemplate(template)).toThrow(/missing its animation/)
  })

  it("reports a load that dropped the animation, and says state was replaced", () => {
    const canvas = createCanvas("tpl-canvas")
    // A timeline the payload still counts (`clips.length`) but the store's
    // normaliser refuses (not an array) — it empties it instead of rejecting
    // the template, which is the drop this check exists to catch.
    const template = makeTemplate({
      state: {
        schemaVersion: DRAFT_SCHEMA_VERSION,
        present: {
          ...DEFAULT_STATE,
          canvases: [
            {
              ...canvas,
              animation: { durationMs: 4000, clips: { length: 2 } },
            },
          ],
          activeCanvasId: canvas.id,
        },
        ui: { isAnimateMode: true },
      },
    })

    let caught: unknown
    try {
      applyTemplate(template)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(TemplateApplyError)
    expect(templateApplyReplacedState(caught)).toBe(true)
    expect(activeCanvas()?.animation?.clips).toHaveLength(0)
  })

  it("refuses a payload with no canvases", () => {
    const template = makeTemplate({ state: { schemaVersion: 1, present: {} } })

    expect(() => applyTemplate(template)).toThrow(/missing its canvas/)
  })
})

describe("templateApplyErrorMessage", () => {
  it("passes a template failure through verbatim", () => {
    expect(
      templateApplyErrorMessage(new TemplateApplyError("Timeline gone", true))
    ).toBe("Timeline gone")
  })

  it("falls back for anything else", () => {
    expect(templateApplyErrorMessage(new Error("boom"))).toBe(
      "Could not apply template"
    )
  })
})
