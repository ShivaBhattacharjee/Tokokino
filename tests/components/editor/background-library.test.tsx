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
                    ![
                      "initial",
                      "animate",
                      "exit",
                      "transition",
                      "variants",
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

vi.mock("@/lib/editor/store", () => ({
  BACKGROUND_LIBRARY: [
    {
      key: "nature",
      label: "Nature",
      items: [
        { full: "f1.jpg", thumb: "t1.jpg", preview: "p1.jpg", name: "Forest" },
        { full: "f2.jpg", thumb: "t2.jpg", preview: "p2.jpg", name: "Ocean" },
      ],
    },
  ],
}))

import { BackgroundLibrary } from "@/components/editor/inspector/background-section-parts/background-library"

describe("BackgroundLibrary", () => {
  it("renders the category tab and background tiles", () => {
    render(<BackgroundLibrary activeSourceUrl={null} onSelect={() => {}} />)
    expect(screen.getByText("Nature")).toBeInTheDocument()
    expect(screen.getByTitle("Forest")).toBeInTheDocument()
    expect(screen.getByTitle("Ocean")).toBeInTheDocument()
  })

  it("selects a background tile", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<BackgroundLibrary activeSourceUrl={null} onSelect={onSelect} />)
    await user.click(screen.getByTitle("Forest"))
    expect(onSelect).toHaveBeenCalledWith("f1.jpg", "t1.jpg", "p1.jpg")
  })
})
