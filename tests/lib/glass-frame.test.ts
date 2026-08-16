import { describe, expect, it } from "vitest"

import { BROWSER_FRAME_PREVIEW_IMAGE_URL } from "@/lib/browser-frame"
import {
  GLASS_CARD_FRAME_ID,
  GLASS_FRAME_PREVIEW_IMAGE_URL,
  GLASS_FRAMES,
  GLASS_STACK_2_FRAME_ID,
  GLASS_STACK_FRAME_ID,
  getGlassFrame,
  glassFrameScreenAspect,
  resolveGlassFrameColor,
} from "@/lib/glass-frame"
import { cropAspectForFrameScreen } from "@/lib/editor/crop-utils"
import { frameNaturalAspect } from "@/lib/editor/screenshot-layout"

const frameValue = (id: string) => ({
  id,
  color: "dark",
  orientation: "horizontal" as const,
})

describe("glass frame registry", () => {
  it("registers the three selectable glass treatments", () => {
    expect(GLASS_FRAMES.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "glass-card", name: "Glass Card" },
      { id: "glass-stack", name: "Glass Cascade" },
      { id: "glass-stack-2", name: "Glass Crown" },
    ])
  })

  it("normalizes saved colors to supported dark and light variants", () => {
    expect(resolveGlassFrameColor("light")).toBe("light")
    expect(resolveGlassFrameColor("dark")).toBe("dark")
    expect(resolveGlassFrameColor("legacy-color")).toBe("dark")
  })

  it("returns null for unknown frame ids instead of treating them as glass", () => {
    expect(getGlassFrame("glass-missing")).toBeNull()
  })

  it("uses a dedicated picker wallpaper instead of the macOS browser preview", () => {
    expect(GLASS_FRAME_PREVIEW_IMAGE_URL).toBe(
      "https://assets.tokokino.com/frames/glass-preview.webp"
    )
    expect(GLASS_FRAME_PREVIEW_IMAGE_URL).not.toBe(
      BROWSER_FRAME_PREVIEW_IMAGE_URL
    )
  })
})

describe("glass frame geometry", () => {
  it("uses one equal-width rim on every side of the media opening", () => {
    for (const frame of GLASS_FRAMES) {
      const outerAspect = frame.size.width / frame.size.height
      const frontWidthCoverage = frame.front.width / frame.size.width
      const screenWidthCoverage = frame.screen.width / frame.size.width

      expect(outerAspect, frame.id).toBeCloseTo(16 / 10, 6)
      expect(frontWidthCoverage, frame.id).toBe(1)
      expect(frame.screen.x, frame.id).toBeGreaterThan(0)
      expect(frame.screen.y, frame.id).toBe(frame.screen.x)
      expect(frame.screen.x * 2 + frame.screen.width, frame.id).toBe(
        frame.size.width
      )
      expect(frame.screen.y * 2 + frame.screen.height, frame.id).toBe(
        frame.size.height
      )
      expect(screenWidthCoverage, frame.id).toBeGreaterThanOrEqual(0.98)
      expect(screenWidthCoverage, frame.id).toBeLessThan(1)
      expect(frame.front.radius, frame.id).toBeLessThanOrEqual(20)
      expect(frame.screen.radius, frame.id).toBe(
        frame.front.radius - frame.screen.x
      )
    }
  })

  it("crops to the actual inner opening while layout uses the outer ratio", () => {
    for (const frame of GLASS_FRAMES) {
      const screenAspect = frame.screen.width / frame.screen.height

      expect(glassFrameScreenAspect(frame.id)).toBeCloseTo(screenAspect, 6)
      expect(cropAspectForFrameScreen(frameValue(frame.id))).toBeCloseTo(
        screenAspect,
        6
      )
      expect(frameNaturalAspect(frameValue(frame.id))).toBeCloseTo(16 / 10, 6)
    }
  })

  it("places Card and Stack behind the lower edge and Stack 2 behind the upper edge", () => {
    const card = getGlassFrame(GLASS_CARD_FRAME_ID)
    const stack = getGlassFrame(GLASS_STACK_FRAME_ID)
    const stack2 = getGlassFrame(GLASS_STACK_2_FRAME_ID)

    expect(card?.layers).toHaveLength(1)
    expect(card?.layers.every((layer) => layer.y > card.front.y)).toBe(true)
    expect(stack?.layers).toHaveLength(2)
    expect(stack?.layers.every((layer) => layer.y > stack.front.y)).toBe(true)
    const cascadeExposure = stack?.layers.map(
      (layer) => layer.y + layer.height - stack.size.height
    )
    expect(cascadeExposure?.[0]).toBeGreaterThanOrEqual(20)
    expect(cascadeExposure?.[1]).toBeGreaterThanOrEqual(40)
    expect(stack2?.layers).toHaveLength(2)
    expect(stack2?.layers.every((layer) => layer.y < stack2.front.y)).toBe(true)
  })
})
