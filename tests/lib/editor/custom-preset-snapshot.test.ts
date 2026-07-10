import { describe, expect, it } from "vitest"

import {
  buildSlotIdRemap,
  captureCustomPresetGeometry,
  remapAnimationForApply,
  resolvePresetType,
  sanitizePresentForCloudDraft,
  shouldSaveAsAnimatePreset,
} from "@/lib/editor/custom-preset-snapshot"
import { createCanvas } from "@/lib/editor/store/defaults"
import type { AnimationClip, CanvasState } from "@/lib/editor/state-types"

function canvasWithClips(slotIds: string[] = []): CanvasState {
  const canvas = createCanvas("c1", { x: 0, y: 0 })
  const slots = slotIds.map((id, i) => ({
    id,
    src: null,
    xPct: 20 + i * 10,
    yPct: 50,
    widthPct: 40,
    heightPct: 40,
    rotation: 0,
    tilt: { rx: 0, ry: 0, rz: 0 },
    scale: 100,
    zIndex: i + 1,
    filter: "none" as const,
  }))
  const clip: AnimationClip = {
    id: "clip-1",
    startMs: 0,
    durationMs: 1000,
    target: slotIds[0]
      ? { scope: "slot", slotId: slotIds[0] }
      : { scope: "main" },
    effects: ["tilt"],
    pose: {
      tilt: { rx: 12, ry: 0, rz: 0 },
      scale: 110,
      screenshotPosition: "center",
      screenshotOffset: { x: 0, y: 0 },
      padding: 40,
      canvasBorderRadius: 16,
      shadow: {
        type: "drop",
        intensity: 40,
        color: "#000000",
        lightSource: "top",
      },
      backdropEffects: canvas.backdrop.effects,
      background: canvas.background,
      slots: Object.fromEntries(
        slots.map((s) => [
          s.id,
          {
            tilt: s.tilt,
            scale: s.scale,
            rotation: s.rotation,
            xPct: s.xPct,
            yPct: s.yPct,
          },
        ])
      ),
    },
  }
  return {
    ...canvas,
    screenshotSlots: slots,
    animation: { durationMs: 5000, clips: [clip], audio: null },
  }
}

describe("custom preset snapshot", () => {
  it("saves style presets without animation by default", () => {
    const canvas = canvasWithClips()
    const geometry = captureCustomPresetGeometry(
      canvas,
      { id: "16-10", w: 16, h: 10 },
      { includeAnimation: false }
    )
    expect(geometry.animation).toBeUndefined()
    expect(geometry.canvasStyle?.padding).toBe(canvas.padding)
  })

  it("includes animation when requested and clips exist", () => {
    const canvas = canvasWithClips(["slot-a", "slot-b"])
    const geometry = captureCustomPresetGeometry(
      canvas,
      { id: "16-10", w: 16, h: 10 },
      { includeAnimation: true }
    )
    expect(geometry.animation?.clips).toHaveLength(1)
    expect(geometry.animation?.sourceSlotIds).toEqual(["slot-a", "slot-b"])
    expect(geometry.animation?.durationMs).toBe(5000)
  })

  it("resolves animate type only in animate mode with clips", () => {
    const withClips = canvasWithClips()
    const empty = createCanvas("c2", { x: 0, y: 0 })
    expect(shouldSaveAsAnimatePreset(true, withClips)).toBe(true)
    expect(shouldSaveAsAnimatePreset(false, withClips)).toBe(false)
    expect(shouldSaveAsAnimatePreset(true, empty)).toBe(false)
    expect(resolvePresetType(true, withClips)).toBe("animate")
    expect(resolvePresetType(false, withClips)).toBe("style")
  })

  it("remaps slot ids on apply", () => {
    const source = canvasWithClips(["old-slot"])
    const geometry = captureCustomPresetGeometry(
      source,
      { id: "16-10", w: 16, h: 10 },
      { includeAnimation: true }
    )
    expect(geometry.animation).toBeDefined()
    const remapped = remapAnimationForApply(
      geometry.animation!,
      ["new-slot"],
      source.background
    )
    expect(remapped.clips).toHaveLength(1)
    expect(remapped.clips[0]?.id).not.toBe("clip-1")
    expect(remapped.clips[0]?.target).toEqual({
      scope: "slot",
      slotId: "new-slot",
    })
    expect(remapped.clips[0]?.pose?.slots["new-slot"]).toBeDefined()
    expect(remapped.clips[0]?.pose?.slots["old-slot"]).toBeUndefined()
    expect(remapped.audio).toBeNull()
  })

  it("builds slot remap by index from sourceSlotIds", () => {
    const map = buildSlotIdRemap(["live-a", "live-b"], ["src-a", "src-b"], [])
    expect(map.get("src-a")).toBe("live-a")
    expect(map.get("src-b")).toBe("live-b")
  })

  it("strips animation audio src for cloud drafts", () => {
    const canvas = createCanvas("c1", { x: 0, y: 0 })
    canvas.animation = {
      durationMs: 5000,
      clips: [],
      audio: {
        src: "blob:http://localhost/abc",
        name: "track.mp3",
        volume: 0.8,
        muted: false,
      },
    }
    const present = {
      activeTool: "pointer" as const,
      aspect: { id: "16-10", w: 16, h: 10 },
      canvasZoom: 100,
      annotation: {
        mode: "pen" as const,
        color: "#000",
        strokeWidth: 2,
        lineStyle: "solid" as const,
        blurEffect: "blur" as const,
        blurAmount: 0,
      },
      canvases: [canvas],
      activeCanvasId: "c1",
    }
    const sanitized = sanitizePresentForCloudDraft(present)
    expect(sanitized.canvases[0]?.animation?.audio?.src).toBe("")
    expect(sanitized.canvases[0]?.animation?.audio?.name).toBe("track.mp3")
  })
})
