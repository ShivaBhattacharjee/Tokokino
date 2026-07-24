import { describe, expect, it } from "vitest"

import {
  applyScreenshotStyle,
  applySlotStyleDefaults,
  CANVAS_BASE_W,
  CANVAS_GAP,
  createScreenshotSlot,
  duplicateLayerItem,
  layoutSlotsInRow,
  migrateLegacySlot,
  placementAfterCanvas,
  removeSlotFromRow,
  resolveMainScreenshotStyle,
  resolveSlotScreenshotStyle,
  scaleScreenshotOffsetForAspectChange,
  screenshotStyleEffects,
  screenshotStyleGroup,
} from "@/lib/editor/store/canvas-helpers"
import { createCanvas } from "@/lib/editor/store/defaults"
import type { Border, DeviceFrame, Shadow } from "@/lib/editor/state-types"

const frame: DeviceFrame = {
  id: "none",
  color: "black",
  orientation: "vertical",
}

const redBorder: Border = {
  color: "#ff0000",
  width: 4,
  style: "solid",
  padding: 0,
}
const glowShadow: Shadow = {
  type: "glow",
  intensity: 80,
  lightSource: "center",
  color: "#00ff00",
}

describe("canvas store helpers", () => {
  it("scales screenshot offset Y when the canvas aspect changes", () => {
    expect(
      scaleScreenshotOffsetForAspectChange({ x: 12, y: 50 }, 16 / 10, 9 / 16)
    ).toEqual({ x: 12, y: 50 * (1100 / (9 / 16) / (1100 / (16 / 10))) })
  })

  it("reflows remaining slots after deleting a row-layout slot", () => {
    const first = createScreenshotSlot({ id: "first" }, 1)
    const second = createScreenshotSlot({ id: "second" }, 2)
    const reflowed = removeSlotFromRow([first, second], "first", frame, 16 / 10)

    expect(reflowed).toHaveLength(1)
    expect(reflowed[0]?.id).toBe("second")
    expect(reflowed[0]?.yPct).toBe(50)
    expect(reflowed[0]?.rotation).toBe(0)
    expect(reflowed[0]?.xPct).toBeCloseTo(75)
    expect(reflowed[0]?.widthPct).toBeCloseTo(48)
  })

  it("packs mixed-frame rows using each slot's effective frame", () => {
    const browser: DeviceFrame = {
      id: "browser",
      color: "dark",
      orientation: "vertical",
    }
    const galaxy: DeviceFrame = {
      id: "galaxy_s24_ultra",
      color: "black",
      orientation: "vertical",
    }
    const slots = [
      createScreenshotSlot({ id: "phone", frame: galaxy }, 1),
      createScreenshotSlot({ id: "wide" }, 2),
    ]

    const asCanvasFrame = layoutSlotsInRow(
      slots.map((s) => ({ ...s, frame: undefined })),
      browser,
      16 / 10
    )
    const mixed = layoutSlotsInRow(slots, browser, 16 / 10)

    // A tall phone next to an inheriting browser box is not the same width as
    // two browser boxes — and the override must still be on the slot after reflow.
    expect(mixed[0]?.frame).toEqual(galaxy)
    expect(mixed[0]?.widthPct).not.toBeCloseTo(
      asCanvasFrame[0]?.widthPct ?? 0,
      1
    )
  })

  it("migrates legacy slots and fills modern defaults", () => {
    const slot = migrateLegacySlot({
      id: "legacy",
      src: "data:image/png;base64,abc",
      xPct: 12,
      tilt: { ry: 15 },
      objectFit: "cover",
    })

    expect(slot.id).toBe("legacy")
    expect(slot.src).toBe("data:image/png;base64,abc")
    expect(slot.xPct).toBe(12)
    expect(slot.yPct).toBe(50)
    expect(slot.tilt).toEqual({ rx: 0, ry: 15, rz: 0 })
    expect(slot.objectFit).toBe("cover")
    expect(slot.heightPct).toBe(28)
  })

  it("preserves a persisted per-slot frame override on load", () => {
    const slot = migrateLegacySlot({
      id: "s",
      frame: { id: "iphone-16-pro", color: "black", orientation: "vertical" },
    })
    expect(slot.frame).toEqual({
      id: "iphone-16-pro",
      color: "black",
      orientation: "vertical",
    })
  })

  it("applies canvas style defaults to slots without mutating canvas values", () => {
    const canvas = {
      ...createCanvas("canvas"),
      padding: 72,
      borderRadius: 18,
      border: {
        color: "#111111",
        width: 3,
        style: "dashed" as const,
        padding: 2,
      },
    }
    const slot = applySlotStyleDefaults(
      createScreenshotSlot({ id: "slot" }, 1),
      canvas
    )

    expect(slot.padding).toBe(72)
    expect(slot.borderRadius).toBe(18)
    expect(slot.border).toEqual(canvas.border)
    expect(slot.border).not.toBe(canvas.border)
  })

  it("duplicates layer items with offset and a new z-index", () => {
    const result = duplicateLayerItem(
      [{ id: "text-1", xPct: 94, yPct: 10, zIndex: 2 }],
      "text-1",
      "text-2",
      8
    )

    expect(result.ok).toBe(true)
    expect(result.items).toHaveLength(2)
    expect(result.items[1]).toEqual({
      id: "text-2",
      xPct: 95,
      yPct: 14,
      zIndex: 8,
    })
  })

  it("resolves main style straight from the canvas fields", () => {
    const canvas = {
      ...createCanvas("c"),
      padding: 55,
      borderRadius: 22,
      shadow: glowShadow,
      objectFit: "cover" as const,
    }
    const style = resolveMainScreenshotStyle(canvas)
    expect(style.padding).toBe(55)
    expect(style.borderRadius).toBe(22)
    expect(style.shadow).toBe(canvas.shadow)
    expect(style.objectFit).toBe("cover")
  })

  it("resolves a slot's own style, falling back to the canvas per field", () => {
    const canvas = {
      ...createCanvas("c"),
      padding: 30,
      shadow: glowShadow,
      border: redBorder,
    }
    const slot = createScreenshotSlot({ id: "s", padding: 90 }, 1)
    const style = resolveSlotScreenshotStyle(slot, canvas)
    // Own padding wins; shadow/border have no per-slot value so inherit.
    expect(style.padding).toBe(90)
    expect(style.shadow).toBe(canvas.shadow)
    expect(style.border).toBe(canvas.border)
    // Slots default objectFit to "contain", not the canvas value.
    expect(style.objectFit).toBe("contain")
  })

  describe("applyScreenshotStyle", () => {
    it("target 'main' patches only the canvas, never the slots", () => {
      const canvas = {
        ...createCanvas("c"),
        screenshotSlots: [createScreenshotSlot({ id: "s" }, 1)],
      }
      const patch = applyScreenshotStyle(canvas, "main", { padding: 77 })
      expect(patch.padding).toBe(77)
      expect(patch.screenshotSlots).toBeUndefined()
    })

    it("maps rotation to the main tilt.rz and lighting into the backdrop", () => {
      const canvas = createCanvas("c")
      const rot = applyScreenshotStyle(canvas, "main", { rotation: 33 })
      expect(rot.tilt).toEqual({ ...canvas.tilt, rz: 33 })

      const lighting = { ...canvas.backdrop.lighting, target: "inner" as const }
      const lit = applyScreenshotStyle(canvas, "main", { lighting })
      expect(lit.backdrop?.lighting).toBe(lighting)
      expect(lit.tilt).toBeUndefined()
    })

    it("target 'all' patches the canvas and mirrors cloned values to every slot", () => {
      const canvas = {
        ...createCanvas("c"),
        screenshotSlots: [
          createScreenshotSlot({ id: "a" }, 1),
          createScreenshotSlot({ id: "b" }, 2),
        ],
      }
      const patch = applyScreenshotStyle(canvas, "all", { shadow: glowShadow })
      expect(patch.shadow).toBe(glowShadow)
      expect(patch.screenshotSlots).toHaveLength(2)
      for (const slot of patch.screenshotSlots!) {
        expect(slot.shadow).toEqual(glowShadow)
        // Each slot gets its own clone, never the shared reference.
        expect(slot.shadow).not.toBe(glowShadow)
      }
    })

    it("target 'all' rotation lands on tilt.rz for main and rotation for slots", () => {
      const canvas = {
        ...createCanvas("c"),
        screenshotSlots: [createScreenshotSlot({ id: "a" }, 1)],
      }
      const patch = applyScreenshotStyle(canvas, "all", { rotation: 25 })
      expect(patch.tilt).toEqual({ ...canvas.tilt, rz: 25 })
      expect(patch.screenshotSlots![0].rotation).toBe(25)
    })

    it("target slotId patches only that slot and leaves the canvas + siblings alone", () => {
      const canvas = {
        ...createCanvas("c"),
        screenshotSlots: [
          createScreenshotSlot({ id: "a" }, 1),
          createScreenshotSlot({ id: "b" }, 2),
        ],
      }
      const patch = applyScreenshotStyle(
        canvas,
        { slotId: "b" },
        {
          border: redBorder,
        }
      )
      expect(patch.border).toBeUndefined()
      const [a, b] = patch.screenshotSlots!
      expect(a.border).toBeUndefined()
      expect(b.border).toEqual(redBorder)
      expect(b.border).not.toBe(redBorder)
    })
  })

  describe("screenshotStyleEffects / group", () => {
    it("maps each style field to its animation effect", () => {
      expect(screenshotStyleEffects({ padding: 1 })).toEqual(["padding"])
      expect(screenshotStyleEffects({ scale: 1 })).toEqual(["zoom"])
      expect(screenshotStyleEffects({ borderRadius: 1 })).toEqual([
        "borderRadius",
      ])
    })

    it("dedupes tilt + rotation to a single 'tilt' effect", () => {
      expect(
        screenshotStyleEffects({ tilt: { rx: 0, ry: 0, rz: 0 }, rotation: 5 })
      ).toEqual(["tilt"])
    })

    it("emits no effect for non-animatable fields like objectFit", () => {
      expect(screenshotStyleEffects({ objectFit: "cover" })).toEqual([])
    })

    it("groups by sorted field set so unlike edits don't merge in history", () => {
      expect(screenshotStyleGroup({ padding: 1 })).toBe(
        "screenshot-style:padding"
      )
      expect(
        screenshotStyleGroup({ scale: 1, tilt: { rx: 0, ry: 0, rz: 0 } })
      ).toBe("screenshot-style:scale,tilt")
    })
  })

  it("places a duplicated canvas to the right unless that slot is occupied", () => {
    const source = createCanvas("source", { x: 0, y: 0 })
    const occupied = createCanvas("occupied", {
      x: CANVAS_BASE_W + CANVAS_GAP,
      y: 0,
    })
    const next = placementAfterCanvas(
      {
        activeTool: "pointer",
        aspect: { id: "16-10", w: 16, h: 10 },
        canvasZoom: 100,
        annotation: {
          mode: "pen",
          color: "#ef4444",
          strokeWidth: 4,
          lineStyle: "solid",
          blurEffect: "blur",
          blurAmount: 14,
        },
        canvases: [source, occupied],
        activeCanvasId: "source",
      },
      "source"
    )

    expect(next).toEqual({ x: 2 * (CANVAS_BASE_W + CANVAS_GAP), y: 0 })
  })
})
