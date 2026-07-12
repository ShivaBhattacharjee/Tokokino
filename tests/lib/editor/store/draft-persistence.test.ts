import { describe, expect, it } from "vitest"

import {
  applyEditorDraft,
  EDITOR_DRAFT_KEY,
  EDITOR_DRAFT_SCHEMA_VERSION,
  normalizeEditorState,
  type PersistedEditorDraft,
} from "@/lib/editor/store/draft-persistence"
import { createCanvas } from "@/lib/editor/store/defaults"

describe("draft persistence", () => {
  it("normalizes missing canvas fields and falls back to an existing active canvas", () => {
    const normalized = normalizeEditorState({
      activeCanvasId: "missing",
      aspect: { id: "story", w: 9, h: 16 },
      canvases: [
        {
          id: "canvas-a",
          position: { x: 10, y: 20 },
          border: { color: "#fff", width: 4, padding: 1 },
          screenshotSlots: [
            { id: "slot-a", xPct: 25, tilt: { rx: 5 } } as never,
          ],
        } as never,
      ],
    })

    expect(normalized.aspect).toEqual({ id: "story", w: 9, h: 16 })
    expect(normalized.activeCanvasId).toBe("canvas-a")
    expect(normalized.canvases[0]?.position).toEqual({ x: 10, y: 20 })
    expect(normalized.canvases[0]?.border).toEqual({
      color: "#fff",
      width: 4,
      style: "solid",
      padding: 1,
    })
    expect(normalized.canvases[0]?.screenshotSlots[0]).toMatchObject({
      id: "slot-a",
      xPct: 25,
      yPct: 50,
      tilt: { rx: 5, ry: 0, rz: 0 },
    })
    expect(normalized.canvases[0]?.screenshotSlots[0]?.padding).toBe(
      normalized.canvases[0]?.padding
    )
  })

  it("applies persisted UI state while clearing volatile history and selection", () => {
    const draft: PersistedEditorDraft = {
      id: EDITOR_DRAFT_KEY,
      schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
      updatedAt: Date.now(),
      present: {
        activeTool: "text",
        aspect: { id: "1-1", w: 1, h: 1 },
        canvasZoom: 80,
        annotation: {
          mode: "pen",
          color: "#111111",
          strokeWidth: 8,
          lineStyle: "solid",
          blurEffect: "blur",
          blurAmount: 12,
        },
        canvases: [createCanvas("saved", { x: 0, y: 0 })],
        activeCanvasId: "saved",
      },
      ui: {
        bulkEditMode: true,
        bulkViewportZoom: 0.75,
        bulkScale: 52,
        presetTab: "multi",
        activeLayoutPresetId: "cascade",
        activeCustomPresetId: null,
        activeSinglePresetId: "left-depth",
        previewAutoScrollDelay: 4500,
        previewAnimation: "fade",
        currentDraft: {
          id: "draft-1",
          name: "Homepage",
          updatedAt: "2026-06-02T00:00:00.000Z",
        },
      },
    }

    const applied = applyEditorDraft(draft)

    expect(applied.past).toEqual([])
    expect(applied.future).toEqual([])
    expect(applied.present?.activeCanvasId).toBe("saved")
    expect(applied.bulkEditMode).toBe(true)
    expect(applied.bulkViewportZoom).toBe(0.75)
    expect(applied.presetTab).toBe("multi")
    expect(applied.activeLayoutPresetId).toBe("cascade")
    expect(applied.previewAnimation).toBe("fade")
    expect(applied.selectedTextId).toBeNull()
    expect(applied.isScreenshotSelected).toBe(false)
    expect(applied.isAnimateMode).toBe(false)
  })

  it("restores animate mode and selects the last clip when ui.isAnimateMode is set", () => {
    const canvas = createCanvas("saved", { x: 0, y: 0 })
    canvas.animation = {
      durationMs: 4000,
      clips: [
        {
          id: "clip-a",
          startMs: 0,
          durationMs: 1000,
          effects: ["tilt"],
        },
        {
          id: "clip-b",
          startMs: 1000,
          durationMs: 1000,
          effects: ["zoom"],
        },
      ],
    }

    const draft: PersistedEditorDraft = {
      id: EDITOR_DRAFT_KEY,
      schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
      updatedAt: Date.now(),
      present: {
        activeTool: "pointer",
        aspect: { id: "1-1", w: 1, h: 1 },
        canvasZoom: 100,
        annotation: {
          mode: "pen",
          color: "#111111",
          strokeWidth: 4,
          lineStyle: "solid",
          blurEffect: "blur",
          blurAmount: 0,
        },
        canvases: [canvas],
        activeCanvasId: "saved",
      },
      ui: {
        bulkEditMode: false,
        bulkViewportZoom: 1,
        bulkScale: 65,
        presetTab: "custom",
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
        activeSinglePresetId: null,
        previewAutoScrollDelay: 3000,
        previewAnimation: "slide",
        currentDraft: null,
        isAnimateMode: true,
      },
    }

    const applied = applyEditorDraft(draft)
    expect(applied.isAnimateMode).toBe(true)
    expect(applied.selectedAnimationClipId).toBe("clip-b")
  })

  it("preserves per-clip transition easing & speed through hydration", () => {
    const canvas = createCanvas("saved", { x: 0, y: 0 })
    canvas.animation = {
      durationMs: 4000,
      clips: [
        {
          id: "clip-a",
          startMs: 0,
          durationMs: 1000,
          effects: ["tilt"],
          easing: "linear",
          speed: 3,
        },
      ],
    }

    const draft: PersistedEditorDraft = {
      id: EDITOR_DRAFT_KEY,
      schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
      updatedAt: Date.now(),
      present: {
        activeTool: "pointer",
        aspect: { id: "1-1", w: 1, h: 1 },
        canvasZoom: 100,
        annotation: {
          mode: "pen",
          color: "#111111",
          strokeWidth: 4,
          lineStyle: "solid",
          blurEffect: "blur",
          blurAmount: 0,
        },
        canvases: [canvas],
        activeCanvasId: "saved",
      },
      ui: {
        bulkEditMode: false,
        bulkViewportZoom: 1,
        bulkScale: 65,
        presetTab: "custom",
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
        activeSinglePresetId: null,
        previewAutoScrollDelay: 3000,
        previewAnimation: "slide",
        currentDraft: null,
        isAnimateMode: true,
      },
    }

    const applied = applyEditorDraft(draft)
    const clip = applied.present?.canvases[0]?.animation?.clips[0]
    expect(clip?.easing).toBe("linear")
    expect(clip?.speed).toBe(3)
  })
})
