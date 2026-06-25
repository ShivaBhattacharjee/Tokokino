import { describe, expect, it } from "vitest"

import {
  clamp,
  isTextEditingTarget,
  readCanvasFitScale,
} from "@/components/editor/text-element-parts/constants"
import { textContentStyle } from "@/components/editor/text-element-parts/text-styles"
import type { TextElement } from "@/lib/editor/state-types"

/**
 * Pure helpers extracted in the text-element refactor. They back drag/resize
 * math and the rendered text style, so regressions are hard to spot in the UI.
 */

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: "t1",
    content: "Hello",
    xPct: 50,
    yPct: 50,
    rotation: 0,
    fontSize: 24,
    fontFamily: "Inter",
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: 0,
    color: "#000000",
    align: "left",
    borderColor: "#000000",
    borderWidth: 0,
    borderStyle: "solid",
    zIndex: 1,
    widthPx: 200,
    heightPx: 80,
    autoColor: false,
    strokeColor: null,
    strokeWidth: 0,
    textShadow: null,
    opacity: 100,
    blendMode: "normal",
    hidden: false,
    ...overrides,
  }
}

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it("clamps to the min and max bounds", () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })
})

describe("isTextEditingTarget", () => {
  it("returns false for null or non-element targets", () => {
    expect(isTextEditingTarget(null)).toBe(false)
    expect(isTextEditingTarget(new EventTarget())).toBe(false)
  })

  it("returns true for an editable element", () => {
    const input = document.createElement("input")
    expect(isTextEditingTarget(input)).toBe(true)
  })

  it("returns true for an element inside a contenteditable region", () => {
    const wrapper = document.createElement("div")
    wrapper.setAttribute("contenteditable", "true")
    const span = document.createElement("span")
    wrapper.appendChild(span)
    document.body.appendChild(wrapper)
    expect(isTextEditingTarget(span)).toBe(true)
    document.body.removeChild(wrapper)
  })

  it("returns false for a plain element", () => {
    expect(isTextEditingTarget(document.createElement("div"))).toBe(false)
  })
})

describe("readCanvasFitScale", () => {
  it("returns the fallback when canvas is null", () => {
    expect(readCanvasFitScale(null, 0.75)).toBe(0.75)
  })

  it("reads a positive --canvas-fit-scale custom property", () => {
    const el = document.createElement("div")
    el.style.setProperty("--canvas-fit-scale", "0.5")
    document.body.appendChild(el)
    expect(readCanvasFitScale(el, 1)).toBe(0.5)
    document.body.removeChild(el)
  })

  it("falls back when the custom property is missing or non-positive", () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    expect(readCanvasFitScale(el, 1.25)).toBe(1.25)
    el.style.setProperty("--canvas-fit-scale", "0")
    expect(readCanvasFitScale(el, 1.25)).toBe(1.25)
    document.body.removeChild(el)
  })
})

describe("textContentStyle", () => {
  it("maps text fields onto CSS properties", () => {
    const style = textContentStyle({
      text: makeText({
        fontFamily: "Roboto",
        color: "#ff0000",
        align: "center",
      }),
      borderStyle: "dashed",
      borderWidth: 2,
      borderColor: "#00ff00",
    })
    expect(style.fontFamily).toBe("Roboto")
    expect(style.color).toBe("#ff0000")
    expect(style.textAlign).toBe("center")
    expect(style.borderStyle).toBe("dashed")
    expect(style.borderWidth).toBe(2)
    expect(style.borderColor).toBe("#00ff00")
  })

  it("uses the explicit fontSize override over the text fontSize", () => {
    const style = textContentStyle({
      text: makeText({ fontSize: 24 }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
      fontSize: 40,
    })
    expect(style.fontSize).toBe(40)
  })

  it("applies a webkit text stroke only when stroke color and width are set", () => {
    const withStroke = textContentStyle({
      text: makeText({ strokeColor: "#fff", strokeWidth: 3 }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
    })
    expect(withStroke.WebkitTextStroke).toBe("3px #fff")
    expect(withStroke.paintOrder).toBe("stroke fill")

    const noStroke = textContentStyle({
      text: makeText({ strokeColor: null, strokeWidth: 0 }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
    })
    expect(noStroke.WebkitTextStroke).toBeUndefined()
  })

  it("includes a text shadow only when present", () => {
    const withShadow = textContentStyle({
      text: makeText({ textShadow: "0 1px 2px #000" }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
    })
    expect(withShadow.textShadow).toBe("0 1px 2px #000")

    const noShadow = textContentStyle({
      text: makeText({ textShadow: null }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
    })
    expect(noShadow.textShadow).toBeUndefined()
  })

  it("defaults lineHeight and letterSpacing when nullish", () => {
    const style = textContentStyle({
      text: makeText({
        lineHeight: null as never,
        letterSpacing: null as never,
      }),
      borderStyle: "solid",
      borderWidth: 0,
      borderColor: "#000",
    })
    expect(style.lineHeight).toBe(1.3)
    expect(style.letterSpacing).toBe("0px")
  })
})
