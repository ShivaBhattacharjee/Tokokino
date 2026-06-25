import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

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
  MobileAspectPicker,
  findAspectOption,
} from "@/components/editor/aspect-popover"

describe("findAspectOption", () => {
  it("returns the option for a known id", () => {
    const opt = findAspectOption("1-1")
    expect(opt?.id).toBe("1-1")
  })

  it("returns undefined for an unknown id", () => {
    expect(findAspectOption("nope-nope")).toBeUndefined()
  })
})

describe("MobileAspectPicker", () => {
  it("renders search and a custom-size apply control", () => {
    render(
      <MobileAspectPicker value="1-1" onChange={() => {}} onClose={() => {}} />
    )
    expect(screen.getByPlaceholderText("Search ratios…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument()
  })

  it("applies a valid custom size and closes", async () => {
    const onChange = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <MobileAspectPicker value="1-1" onChange={onChange} onClose={onClose} />
    )

    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(onChange).toHaveBeenCalledWith("custom", { w: 1920, h: 1200 })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("shows a no-matches message for an unmatched query", async () => {
    const user = userEvent.setup()
    render(
      <MobileAspectPicker value="1-1" onChange={() => {}} onClose={() => {}} />
    )
    await user.type(screen.getByPlaceholderText("Search ratios…"), "zzqqxx")
    expect(screen.getByText(/No matches/)).toBeInTheDocument()
  })
})
