import { describe, expect, it } from "vitest"

import { DEFAULT_BASELINE, poseAtCut } from "@/lib/editor/animation-playback"
import type { ClipBaseline } from "@/lib/editor/state-types"

const base = (over: Partial<ClipBaseline>): ClipBaseline => ({
  ...DEFAULT_BASELINE,
  ...over,
})

// easeOut(t) = 1 - (1 - t)^3; easeOut(0.5) = 0.875.
describe("poseAtCut (razor split boundary keyframe)", () => {
  it("eases an owned continuous effect (shadow) to the eased cut value", () => {
    const from = base({
      shadow: {
        type: "drop",
        intensity: 0,
        color: "#000000",
        lightSource: "center",
      },
    })
    const to = base({
      shadow: {
        type: "drop",
        intensity: 100,
        color: "#000000",
        lightSource: "center",
      },
    })
    const mid = poseAtCut(from, to, 0.5, ["shadow"], true, [])
    // lerp(0, 100, easeOut(0.5)=0.875) = 87.5
    expect(mid.shadow.intensity).toBeCloseTo(87.5, 5)
  })

  it("eases an owned numeric effect and holds unowned effects at the target", () => {
    const from = base({ scale: 100, padding: 0 })
    const to = base({ scale: 200, padding: 120 })
    const mid = poseAtCut(from, to, 0.5, ["zoom"], true, [])
    expect(mid.scale).toBeCloseTo(187.5, 5) // lerp(100, 200, 0.875)
    expect(mid.padding).toBe(120) // padding not owned → holds the target value
  })

  it("resolves a discrete crossfade to whichever half the cut is nearer to", () => {
    const from = base({ background: { type: "solid", value: "#111111" } })
    const to = base({ background: { type: "solid", value: "#eeeeee" } })
    // easeOut(0.1) ≈ 0.271 (< 0.5) → old; easeOut(0.9) ≈ 0.999 (≥ 0.5) → new.
    expect(
      poseAtCut(from, to, 0.1, ["background"], true, []).background
    ).toEqual(from.background)
    expect(
      poseAtCut(from, to, 0.9, ["background"], true, []).background
    ).toEqual(to.background)
  })

  it("leaves the pose untouched when no effect is owned", () => {
    const mid = poseAtCut(
      base({ scale: 100 }),
      base({ scale: 200 }),
      0.5,
      [],
      true,
      []
    )
    expect(mid.scale).toBe(200)
  })

  it("eases an owned slot effect for affected slots", () => {
    const from = base({
      slots: { a: { tilt: { rx: 0, ry: 0, rz: 0 }, scale: 100, rotation: 0 } },
    })
    const to = base({
      slots: { a: { tilt: { rx: 0, ry: 0, rz: 0 }, scale: 300, rotation: 0 } },
    })
    const mid = poseAtCut(from, to, 0.5, ["zoom"], false, ["a"])
    expect(mid.slots.a.scale).toBeCloseTo(275, 5) // lerp(100, 300, 0.875)
  })
})
