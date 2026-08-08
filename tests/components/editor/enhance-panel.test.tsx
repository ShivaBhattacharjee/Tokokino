import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileEnhancePanel` — grid of enhance presets driven by the store.
 */
const store = vi.hoisted(() => ({
  enhance: "off",
  screenshot: null as string | null,
  fullPageCapture: null as { scrollPosition: number } | null,
  setEnhance: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({
      enhance: store.enhance,
      screenshot: store.screenshot,
      fullPageCapture: store.fullPageCapture,
      screenshotSlots: [],
    }),
  useActiveCanvasId: () => "canvas-1",
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({ setEnhance: store.setEnhance }),
}))

import { MobileEnhancePanel } from "@/components/editor/mobile-controls/enhance-panel"
import { ENHANCE_PRESETS } from "@/components/editor/enhance-presets"

beforeEach(() => {
  store.enhance = "off"
  store.screenshot = null
  store.fullPageCapture = null
})
afterEach(() => vi.clearAllMocks())

describe("MobileEnhancePanel", () => {
  it("renders a button for every enhance preset", () => {
    render(<MobileEnhancePanel />)
    for (const preset of ENHANCE_PRESETS) {
      expect(
        screen.getByRole("button", { name: preset.label })
      ).toBeInTheDocument()
    }
  })

  it("highlights the active preset", () => {
    store.enhance = "vivid"
    render(<MobileEnhancePanel />)
    expect(screen.getByRole("button", { name: "Vivid" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("previews each preset on the canvas screenshot when there is one", () => {
    store.screenshot = "data:image/png;base64,AAAA"
    const { container } = render(<MobileEnhancePanel />)
    const previews = container.querySelectorAll<HTMLElement>(
      "[style*='background-image']"
    )
    expect(previews).toHaveLength(ENHANCE_PRESETS.length)
    expect(previews[0].style.backgroundImage).toContain(
      "data:image/png;base64,AAAA"
    )
  })

  it("matches the long-screenshot scroll crop in preset thumbs", () => {
    store.screenshot = "data:image/png;base64,AAAA"
    store.fullPageCapture = { scrollPosition: 12 }
    const { container } = render(<MobileEnhancePanel />)
    const previews = container.querySelectorAll<HTMLElement>(
      "[style*='background-image']"
    )
    expect(previews[0].style.backgroundPosition).toBe("50% 12%")
  })

  it("applies a preset on click", async () => {
    const user = userEvent.setup()
    render(<MobileEnhancePanel />)
    await user.click(screen.getByRole("button", { name: "Dramatic" }))
    expect(store.setEnhance).toHaveBeenCalledWith("dramatic")
  })
})
