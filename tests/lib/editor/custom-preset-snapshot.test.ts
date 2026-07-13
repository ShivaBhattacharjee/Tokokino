import { describe, expect, it } from "vitest"

import {
  buildSlotIdRemap,
  captureCustomPresetGeometry,
  remapAnimationForApply,
  resolvePresetType,
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
    animation: { durationMs: 5000, clips: [clip] },
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
  })

  it("preserves per-clip easing & speed through capture and apply", () => {
    const source = canvasWithClips(["old-slot"])
    source.animation = {
      ...source.animation!,
      clips: [{ ...source.animation!.clips[0], easing: "linear", speed: 2.5 }],
    }
    const geometry = captureCustomPresetGeometry(
      source,
      { id: "16-10", w: 16, h: 10 },
      { includeAnimation: true }
    )
    const saved = geometry.animation!.clips[0] as {
      easing?: string
      speed?: number
    }
    expect(saved.easing).toBe("linear")
    expect(saved.speed).toBe(2.5)

    const remapped = remapAnimationForApply(
      geometry.animation!,
      ["new-slot"],
      source.background
    )
    expect(remapped.clips[0]?.easing).toBe("linear")
    expect(remapped.clips[0]?.speed).toBe(2.5)
  })

  it("builds slot remap by index from sourceSlotIds", () => {
    const map = buildSlotIdRemap(["live-a", "live-b"], ["src-a", "src-b"], [])
    expect(map.get("src-a")).toBe("live-a")
    expect(map.get("src-b")).toBe("live-b")
  })
})
