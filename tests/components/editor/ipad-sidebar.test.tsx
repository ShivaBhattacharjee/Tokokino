import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

/**
 * `IpadSidebar` — folds the design + tools panels into a single tabbed panel
 * for iPad widths, with Design/Tools tabs and horizontal swipe navigation.
 */

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
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
                    ![
                      "initial",
                      "animate",
                      "exit",
                      "transition",
                      "layoutId",
                    ].includes(k)
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

vi.mock("@/components/editor/effects-sidebar", () => ({
  EffectsSidebar: () => <div data-testid="effects-sidebar" />,
  AccountTile: () => <div data-testid="account-tile" />,
}))

vi.mock("@/components/editor/inspector", () => ({
  Inspector: () => <div data-testid="inspector" />,
}))

import { IpadSidebar } from "@/components/editor/ipad-sidebar"

describe("IpadSidebar", () => {
  it("renders Design and Tools tabs plus both panels and the account tile", () => {
    render(<IpadSidebar />)
    expect(screen.getByRole("button", { name: "Design" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tools" })).toBeInTheDocument()
    expect(screen.getByTestId("effects-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("inspector")).toBeInTheDocument()
    expect(screen.getByTestId("account-tile")).toBeInTheDocument()
  })

  it("defaults to the Design panel being interactive", () => {
    render(<IpadSidebar />)
    const designPanel = screen.getByTestId("effects-sidebar").parentElement!
    const toolsPanel = screen.getByTestId("inspector").parentElement!
    expect(designPanel).toHaveAttribute("aria-hidden", "false")
    expect(toolsPanel).toHaveAttribute("aria-hidden", "true")
  })

  it("activates the Tools panel when the Tools tab is clicked", async () => {
    const user = userEvent.setup()
    render(<IpadSidebar />)

    await user.click(screen.getByRole("button", { name: "Tools" }))

    const designPanel = screen.getByTestId("effects-sidebar").parentElement!
    const toolsPanel = screen.getByTestId("inspector").parentElement!
    expect(toolsPanel).toHaveAttribute("aria-hidden", "false")
    expect(designPanel).toHaveAttribute("aria-hidden", "true")
  })

  it("swipes left to move from Design to Tools", () => {
    render(<IpadSidebar />)
    const swipeArea =
      screen.getByTestId("effects-sidebar").parentElement!.parentElement!
        .parentElement!

    fireEvent.touchStart(swipeArea, { touches: [{ clientX: 200 }] })
    fireEvent.touchEnd(swipeArea, { changedTouches: [{ clientX: 100 }] })

    expect(screen.getByTestId("inspector").parentElement!).toHaveAttribute(
      "aria-hidden",
      "false"
    )
  })

  it("ignores small swipe movements below the threshold", () => {
    render(<IpadSidebar />)
    const swipeArea =
      screen.getByTestId("effects-sidebar").parentElement!.parentElement!
        .parentElement!

    fireEvent.touchStart(swipeArea, { touches: [{ clientX: 200 }] })
    fireEvent.touchEnd(swipeArea, { changedTouches: [{ clientX: 180 }] })

    // Still on Design.
    expect(
      screen.getByTestId("effects-sidebar").parentElement!
    ).toHaveAttribute("aria-hidden", "false")
  })
})
