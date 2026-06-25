import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: Record<string, unknown>) =>
            React.createElement(
              tag,
              Object.fromEntries(
                Object.entries(props).filter(
                  ([k]) =>
                    !["initial", "animate", "exit", "transition"].includes(k)
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

import {
  TabTriggerRow,
  emptyCanvasPresetUi,
} from "@/components/editor/present-presets-section/tabs"

describe("emptyCanvasPresetUi", () => {
  it("returns the tab with all active ids cleared", () => {
    expect(emptyCanvasPresetUi("multi")).toEqual({
      tab: "multi",
      activeLayoutPresetId: null,
      activeSinglePresetId: null,
      activeCustomPresetId: null,
    })
  })
})

describe("TabTriggerRow", () => {
  it("shows the current tab label", () => {
    render(<TabTriggerRow tab="single" slotCount={1} onTabChange={() => {}} />)
    expect(screen.getByText("Single")).toBeInTheDocument()
  })

  it("opens the tab grid and switches tabs", async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TabTriggerRow tab="single" slotCount={1} onTabChange={onTabChange} />
    )

    await user.click(screen.getByRole("button", { name: /Single/ }))
    // Multi tile is available with a single screenshot box.
    await user.click(screen.getByRole("button", { name: "Multi" }))
    expect(onTabChange).toHaveBeenCalledWith("multi")
  })

  it("disables Multi and Triple when a tweet is present", async () => {
    const onTabChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TabTriggerRow
        tab="single"
        slotCount={1}
        hasTweet
        onTabChange={onTabChange}
      />
    )

    await user.click(screen.getByRole("button", { name: /Single/ }))
    expect(screen.getByRole("button", { name: "Multi" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Triple" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Multi" }))
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it("disables Multi when there are more than 2 slots", async () => {
    const user = userEvent.setup()
    render(<TabTriggerRow tab="triple" slotCount={3} onTabChange={() => {}} />)
    await user.click(screen.getByRole("button", { name: /Triple/ }))
    expect(screen.getByRole("button", { name: "Multi" })).toBeDisabled()
  })
})
