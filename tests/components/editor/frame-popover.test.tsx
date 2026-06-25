import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({ screenshot: null }),
}))

vi.mock("motion/react", async () => {
  const React = await import("react")
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
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
                    ![
                      "initial",
                      "animate",
                      "exit",
                      "transition",
                      "layoutId",
                      "layout",
                    ].includes(k)
                )
              ),
              children as React.ReactNode
            ),
      }
    ),
  }
})

import {
  MobileFramePicker,
  findFrameOptionName,
} from "@/components/editor/frame-popover"

describe("findFrameOptionName", () => {
  it("returns None for an unknown frame id", () => {
    expect(findFrameOptionName("not-a-frame")).toBe("None")
  })

  it("returns a name for a known frame id", () => {
    expect(typeof findFrameOptionName("none")).toBe("string")
  })
})

describe("MobileFramePicker", () => {
  const frame = { id: "none", color: "", orientation: "vertical" as const }

  it("renders the device search", () => {
    render(<MobileFramePicker value={frame} onChange={() => {}} />)
    expect(screen.getByPlaceholderText("Search devices…")).toBeInTheDocument()
  })

  it("shows a no-matches message for an unmatched query", async () => {
    const user = userEvent.setup()
    render(<MobileFramePicker value={frame} onChange={() => {}} />)
    await user.type(screen.getByPlaceholderText("Search devices…"), "zzqqxx")
    expect(screen.getByText(/No matches/)).toBeInTheDocument()
  })
})
