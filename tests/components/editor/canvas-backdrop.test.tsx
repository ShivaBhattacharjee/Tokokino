import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CanvasBackdrop } from "@/components/editor/canvas/canvas-backdrop"

/**
 * `CanvasBackdrop` — renders the background, pattern, noise and overlay layers.
 * CSS helpers run for real; we assert the observable layer structure.
 */
type Props = React.ComponentProps<typeof CanvasBackdrop>

const baseProps = (over: Partial<Props> = {}): Props =>
  ({
    background: { type: "none", value: "" },
    backdrop: {
      effects: {
        noise: 0,
        blur: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        grayscale: 0,
        sepia: 0,
        invert: 0,
        opacity: 100,
      },
      pattern: { ids: [], intensity: 50, thickness: 1, color: "#000" },
      filter: "none",
      lighting: { target: "inner" },
    },
    effectsFilter: undefined,
    noiseEnabled: false,
    noiseOpacity: 0,
    portrait: { mode: "off", intensity: 0, position: "center", distance: 0 },
    overlay: { id: null, opacity: 0, position: "overlay" },
    ...over,
  }) as Props

describe("CanvasBackdrop", () => {
  it("renders a transparency checker when the background is none", () => {
    const { container } = render(<CanvasBackdrop {...baseProps()} />)
    expect(container.querySelector(".bg-transparency-checker")).not.toBeNull()
  })

  it("marks the noise layer enabled only when noiseEnabled is set", () => {
    const off = render(
      <CanvasBackdrop {...baseProps({ noiseEnabled: false })} />
    )
    expect(off.container.querySelector("[data-noise-enabled]")).toBeNull()

    const on = render(
      <CanvasBackdrop
        {...baseProps({ noiseEnabled: true, noiseOpacity: 0.5 })}
      />
    )
    expect(on.container.querySelector("[data-noise-enabled]")).not.toBeNull()
  })

  it("renders an underlay overlay layer when an overlay is set to underlay", () => {
    const { container } = render(
      <CanvasBackdrop
        {...baseProps({
          overlay: { id: 5, opacity: 60, position: "underlay" },
        })}
      />
    )
    expect(container.querySelector(".bg-cover.bg-center")).not.toBeNull()
  })

  it("does not render an overlay layer when overlay id is null", () => {
    const { container } = render(<CanvasBackdrop {...baseProps()} />)
    expect(container.querySelector(".bg-cover.bg-center")).toBeNull()
  })

  /**
   * The background layer must read `--bd-fx-preview` even with neutral committed
   * effects — slider drags and the animation player drive that var, and a layer
   * with no `filter` at all has nothing to drive. The neutral fallback has to be
   * an identity function, not `none`, so it stays valid next to an asset filter.
   */
  it("always reads the effects preview var, with an identity fallback", () => {
    const { container } = render(<CanvasBackdrop {...baseProps()} />)
    const layer = container.querySelector<HTMLElement>(
      ".bg-transparency-checker"
    )
    expect(layer?.style.filter).toBe("var(--bd-fx-preview, brightness(1))")
  })

  it("keeps the preview var valid alongside a backdrop asset filter", () => {
    const { container } = render(
      <CanvasBackdrop
        {...baseProps({
          backdrop: { ...baseProps().backdrop, filter: "bw" },
        })}
      />
    )
    const filter = container.querySelector<HTMLElement>(
      ".bg-transparency-checker"
    )?.style.filter
    expect(filter).toContain("var(--bd-fx-preview, brightness(1))")
    expect(filter).not.toContain("none")
  })

  it("uses the committed effects filter as the preview fallback", () => {
    const { container } = render(
      <CanvasBackdrop {...baseProps({ effectsFilter: "brightness(120%)" })} />
    )
    const layer = container.querySelector<HTMLElement>(
      ".bg-transparency-checker"
    )
    expect(layer?.style.filter).toBe("var(--bd-fx-preview, brightness(120%))")
  })
})
