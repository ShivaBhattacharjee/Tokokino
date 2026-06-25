import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `InlineOptions` — routes a `CategoryId` to the matching mobile panel. Each
 * target panel is stubbed; the test asserts the routing switch.
 */
vi.mock("@/components/editor/aspect-popover", () => ({
  MobileAspectPicker: () => <div data-testid="aspect-picker" />,
}))
vi.mock("@/components/editor/layers-popover", () => ({
  LayersPanelContent: () => <div data-testid="layers" />,
}))
vi.mock("@/components/editor/present-presets-section", () => ({
  PresentPresetsSection: () => <div data-testid="present" />,
}))
vi.mock("@/components/editor/inspector/backdrop-section", () => ({
  BackdropSection: () => <div data-testid="backdrop" />,
}))
vi.mock("@/components/editor/inspector/background-section", () => ({
  BackgroundSection: () => <div data-testid="background" />,
}))
vi.mock("@/components/editor/inspector/border-section", () => ({
  BorderSection: () => <div data-testid="border" />,
}))
vi.mock("@/components/editor/inspector/padding-section", () => ({
  PaddingSection: () => <div data-testid="padding" />,
}))
vi.mock("@/components/editor/inspector/shadow-section", () => ({
  ShadowSection: () => <div data-testid="shadow" />,
}))
vi.mock("@/components/editor/inspector/tilt-section", () => ({
  TiltSection: () => <div data-testid="tilt" />,
}))
vi.mock("@/components/editor/inspector/tweet-section", () => ({
  TweetSection: () => <div data-testid="tweet" />,
}))
vi.mock("@/components/editor/mobile-controls/enhance-panel", () => ({
  MobileEnhancePanel: () => <div data-testid="enhance" />,
}))
vi.mock("@/components/editor/mobile-controls/fit-panel", () => ({
  MobileFitPanel: () => <div data-testid="fit" />,
}))
vi.mock("@/components/editor/mobile-controls/move-panel", () => ({
  MobileMovePanel: () => <div data-testid="move" />,
}))

import { InlineOptions } from "@/components/editor/mobile-controls/inline-options"
import type { CategoryId } from "@/components/editor/mobile-controls/categories"

const baseProps = {
  aspect: { id: "16-9", w: 16, h: 9 },
  onAspectChange: () => {},
  onClose: () => {},
}

describe("InlineOptions routing", () => {
  const cases: [CategoryId, string][] = [
    ["aspect", "aspect-picker"],
    ["layout", "present"],
    ["layers", "layers"],
    ["fit", "fit"],
    ["move", "move"],
    ["enhance", "enhance"],
    ["background", "background"],
    ["backdrop", "backdrop"],
    ["border", "border"],
    ["padding", "padding"],
    ["shadow", "shadow"],
    ["tweet", "tweet"],
    ["transform", "tilt"],
  ]

  it.each(cases)("renders the %s panel", (id, testid) => {
    render(<InlineOptions id={id} {...baseProps} />)
    expect(screen.getByTestId(testid)).toBeInTheDocument()
  })
})
