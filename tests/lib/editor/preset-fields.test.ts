import { describe, expect, it } from "vitest"

import {
  type CustomPresetCanvasStyle,
  mergeCanvasStyle,
  pickPresetStyle,
  PRESET_NON_STYLE_KEYS,
} from "@/lib/editor/preset-fields"
import { createCanvas } from "@/lib/editor/store/defaults"
import type { DeviceFrame, TweetCard } from "@/lib/editor/state-types"

describe("pickPresetStyle", () => {
  it("drops every non-style key", () => {
    const style = pickPresetStyle(createCanvas("c1"))
    for (const key of PRESET_NON_STYLE_KEYS) {
      expect(style).not.toHaveProperty(key)
    }
  })

  it("keeps representative style fields", () => {
    const canvas = createCanvas("c1")
    canvas.padding = 123
    canvas.frameAddress = "example.com"
    const style = pickPresetStyle(canvas)
    expect(style.padding).toBe(123)
    expect(style.frameAddress).toBe("example.com")
    expect(style.background).toEqual(canvas.background)
  })

  it("skips undefined optionals so they can't clobber a live value on apply", () => {
    const canvas = createCanvas("c1")
    canvas.objectFit = undefined
    expect(pickPresetStyle(canvas)).not.toHaveProperty("objectFit")
  })
})

describe("mergeCanvasStyle", () => {
  it("returns the base untouched when there is no style bag", () => {
    const base = createCanvas("c1")
    expect(mergeCanvasStyle(base, undefined)).toBe(base)
  })

  it("round-trips a captured style onto a different base", () => {
    const source = createCanvas("src")
    source.padding = 200
    source.borderRadius = 40
    source.enhance = "vivid"
    const merged = mergeCanvasStyle(
      createCanvas("dst"),
      pickPresetStyle(source)
    )
    expect(merged.padding).toBe(200)
    expect(merged.borderRadius).toBe(40)
    expect(merged.enhance).toBe("vivid")
    // identity stays with the base the preset is applied to
    expect(merged.id).toBe("dst")
  })

  it("never lets a malformed bag overwrite identity, placement, or live pixels", () => {
    const base = createCanvas("dst", { x: 5, y: 9 })
    base.screenshot = "data:image/png;base64,LIVE"
    // A newer/corrupt preset carrying non-style keys plus one real style field.
    const bag = {
      id: "hijacked",
      position: { x: 999, y: 999 },
      screenshot: "data:image/png;base64,EVIL",
      screenshotSlots: [{ id: "x" }],
      padding: 77,
    } as unknown as CustomPresetCanvasStyle

    const merged = mergeCanvasStyle(base, bag)

    expect(merged.id).toBe("dst")
    expect(merged.position).toEqual({ x: 5, y: 9 })
    expect(merged.screenshot).toBe("data:image/png;base64,LIVE")
    expect(merged.screenshotSlots).toBe(base.screenshotSlots)
    expect(merged.padding).toBe(77) // the real style field still merges
  })

  it("ignores a nullish style value instead of blanking the live field", () => {
    const base = createCanvas("dst")
    const liveBackground = base.background
    const bag = { background: null } as unknown as CustomPresetCanvasStyle
    expect(mergeCanvasStyle(base, bag).background).toBe(liveBackground)
  })

  it("does not retarget a tweet card's frame", () => {
    const base = createCanvas("dst")
    base.tweet = { theme: "dark" } as unknown as TweetCard
    const originalFrame = base.frame
    const bag: CustomPresetCanvasStyle = {
      frame: { id: "iphone-15", color: "black", orientation: "vertical" },
    }
    expect(mergeCanvasStyle(base, bag).frame).toBe(originalFrame)
  })

  it("applies the style frame when the base has no tweet", () => {
    const base = createCanvas("dst") // tweet defaults to null
    const frame: DeviceFrame = {
      id: "iphone-15",
      color: "black",
      orientation: "vertical",
    }
    expect(mergeCanvasStyle(base, { frame }).frame).toEqual(frame)
  })

  it("merges tweetSettings onto an existing tweet card", () => {
    const base = createCanvas("dst")
    base.tweet = { theme: "dark", showMetrics: true } as unknown as TweetCard
    const bag = {
      tweetSettings: { theme: "light" },
    } as unknown as CustomPresetCanvasStyle
    const merged = mergeCanvasStyle(base, bag)
    expect((merged.tweet as TweetCard).theme).toBe("light")
    // untouched tweet fields survive the shallow merge
    expect((merged.tweet as TweetCard).showMetrics).toBe(true)
  })

  it("does not resurrect a tweet from tweetSettings when the base has none", () => {
    const base = createCanvas("dst") // tweet is null
    const bag = {
      tweetSettings: { theme: "light" },
    } as unknown as CustomPresetCanvasStyle
    expect(mergeCanvasStyle(base, bag).tweet).toBeNull()
  })
})
