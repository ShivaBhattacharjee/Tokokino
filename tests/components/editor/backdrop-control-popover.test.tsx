import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useScroll: () => ({ scrollYProgress: 0 }),
    useTransform: () => 0,
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

import { BackdropControlPopover } from "@/components/editor/inspector/backdrop-section-parts/control-popover"

const Icon = () => <svg data-testid="icon" />

function renderControl(
  props: Partial<React.ComponentProps<typeof BackdropControlPopover>> = {}
) {
  return render(
    <BackdropControlPopover
      icon={Icon}
      label="Effects"
      title="Effects"
      description="Adjust the backdrop."
      {...props}
    >
      <div data-testid="body">controls</div>
    </BackdropControlPopover>
  )
}

describe("BackdropControlPopover (inline)", () => {
  it("shows the tile and hides the body when closed", () => {
    renderControl({
      presentation: "inline",
      open: false,
      onOpenChange: vi.fn(),
    })
    expect(screen.getByText("Effects")).toBeInTheDocument()
    expect(screen.queryByTestId("body")).not.toBeInTheDocument()
  })

  it("shows the body and title when open", () => {
    renderControl({ presentation: "inline", open: true, onOpenChange: vi.fn() })
    expect(screen.getByTestId("body")).toBeInTheDocument()
  })

  it("toggles open via the tile", async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    renderControl({ presentation: "inline", open: false, onOpenChange })
    await user.click(screen.getByText("Effects"))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it("calls onReset from the open panel", async () => {
    const onReset = vi.fn()
    const user = userEvent.setup()
    renderControl({
      presentation: "inline",
      open: true,
      onOpenChange: vi.fn(),
      onReset,
      resetTitle: "Reset effects",
    })
    await user.click(screen.getByRole("button", { name: "Reset effects" }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})

describe("BackdropControlPopover (popover)", () => {
  it("opens the body from the trigger", async () => {
    const user = userEvent.setup()
    renderControl({ presentation: "popover" })
    expect(screen.queryByTestId("body")).not.toBeInTheDocument()
    await user.click(screen.getByText("Effects"))
    expect(screen.getByTestId("body")).toBeInTheDocument()
  })
})
