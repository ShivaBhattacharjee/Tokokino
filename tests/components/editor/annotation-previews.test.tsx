import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  BlurRedactionShape,
  LineStylePreview,
  RedactionTemplatePreview,
} from "@/components/editor/annotation-shape/previews"
import type { AnnotationShape } from "@/lib/editor/store"

/**
 * Annotation preview glyphs — pure SVG/CSS by kind/effect.
 */
describe("LineStylePreview", () => {
  it("draws arrow paths for arrow shapes", () => {
    const { container } = render(
      <LineStylePreview style="solid" kind="arrow" active />
    )
    expect(container.querySelectorAll("path")).toHaveLength(2)
  })

  it("draws a rect for rect shapes", () => {
    const { container } = render(
      <LineStylePreview style="dashed" kind="rect" active={false} />
    )
    expect(container.querySelector("rect")).not.toBeNull()
  })

  it("draws a circle for other shapes", () => {
    const { container } = render(
      <LineStylePreview style="solid" kind="ellipse" active={false} />
    )
    expect(container.querySelector("circle")).not.toBeNull()
  })
})

describe("RedactionTemplatePreview", () => {
  it("renders a span for each effect variant", () => {
    for (const effect of [
      "blur",
      "redact-stripe",
      "pixelate",
      "redact",
    ] as const) {
      const { container } = render(
        <RedactionTemplatePreview effect={effect} active />
      )
      expect(container.querySelector("span")).not.toBeNull()
    }
  })
})

describe("BlurRedactionShape", () => {
  const shape = (over: Partial<AnnotationShape>): AnnotationShape => ({
    id: "s",
    kind: "blur",
    xPct: 0,
    yPct: 0,
    widthPct: 10,
    heightPct: 10,
    rotation: 0,
    color: "#000",
    strokeWidth: 1,
    lineStyle: "solid",
    zIndex: 0,
    ...over,
  })

  it("renders a redaction overlay div for each effect", () => {
    for (const blurEffect of [
      "redact",
      "redact-light",
      "redact-stripe",
      "pixelate",
      "blur",
    ] as const) {
      const { container } = render(
        <BlurRedactionShape shape={shape({ blurEffect })} />
      )
      const el = container.firstElementChild as HTMLElement
      expect(el).not.toBeNull()
      expect(el).toHaveClass("absolute", "inset-0")
    }
  })
})
