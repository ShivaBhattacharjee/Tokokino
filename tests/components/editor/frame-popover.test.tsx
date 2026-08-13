import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  useCanvasPreviewMode: () => false,
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({
      screenshot: "data:video/mp4;base64,AAAA",
      objectFit: "cover",
      fullPageCapture: null,
    }),
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

  it("exposes each glass treatment to frame consumers", () => {
    expect(findFrameOptionName("glass-card")).toBe("Glass Card")
    expect(findFrameOptionName("glass-stack")).toBe("Glass Cascade")
    expect(findFrameOptionName("glass-stack-2")).toBe("Glass Crown")
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

  it("renders video elements in device tiles when the canvas has a video", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MobileFramePicker value={frame} onChange={() => {}} />
    )
    // Open enough of the list that lazy tiles mount; Safari is near the top.
    await user.click(screen.getByText("Safari"))
    const videos = container.querySelectorAll("video")
    expect(videos.length).toBeGreaterThan(0)
    expect(videos[0]?.getAttribute("src")).toBe("data:video/mp4;base64,AAAA")
  })

  it("shows a full-page capture at its canvas crop in frame tiles", async () => {
    const { container } = render(
      <MobileFramePicker
        value={frame}
        onChange={() => {}}
        previewImage="full-page.png"
        previewFullPageCapture={{ scrollPosition: 38 }}
        imageFit="contain"
      />
    )

    await waitFor(() => {
      const preview = Array.from(container.querySelectorAll("img")).find(
        (image) => image.getAttribute("src") === "full-page.png"
      )
      expect(preview).toBeTruthy()
      expect(preview).toHaveClass("object-cover")
      expect(preview).toHaveStyle({ objectPosition: "50% 38%" })
    })
  })
})
