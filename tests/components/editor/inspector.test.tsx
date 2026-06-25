import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `Inspector` — composes the inspector sections, conditionally showing/hiding
 * Tweet / Border / Padding based on the active canvas (device frame, tweet,
 * screenshot count). Section bodies are stubbed; `Section` renders its title so
 * we can assert which sections are mounted.
 */

type Canvas = {
  frame: { id: string }
  tweet: { data: { source: string } } | null
  screenshot: string | null
  screenshotSlots: unknown[]
}

const store = vi.hoisted(() => {
  const canvas: Canvas = {
    frame: { id: "none" },
    tweet: null,
    screenshot: "shot.png",
    screenshotSlots: [],
  }
  return { canvas }
})

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector(store.canvas),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/editor/inspector/primitives", () => ({
  Section: ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => <div data-section={title}>{children}</div>,
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

import { Inspector } from "@/components/editor/inspector"

function sectionTitles() {
  return Array.from(document.querySelectorAll("[data-section]")).map((el) =>
    el.getAttribute("data-section")
  )
}

beforeEach(() => {
  store.canvas = {
    frame: { id: "none" },
    tweet: null,
    screenshot: "shot.png",
    screenshotSlots: [],
  }
})

afterEach(() => vi.clearAllMocks())

describe("Inspector", () => {
  it("always renders Background, Backdrop, Tilt & Scale and Shadow", () => {
    render(<Inspector />)
    expect(sectionTitles()).toEqual(
      expect.arrayContaining([
        "Background",
        "Backdrop",
        "Tilt & Scale",
        "Shadow",
      ])
    )
  })

  it("shows Border and Padding for a plain single screenshot with no frame", () => {
    render(<Inspector />)
    expect(sectionTitles()).toContain("Border")
    expect(sectionTitles()).toContain("Padding")
  })

  it("hides Border when a device frame is active", () => {
    store.canvas.frame = { id: "iphone" }
    render(<Inspector />)
    expect(sectionTitles()).not.toContain("Border")
  })

  it("hides Padding when there are multiple screenshot boxes", () => {
    store.canvas.screenshotSlots = [{}, {}]
    render(<Inspector />)
    expect(sectionTitles()).not.toContain("Padding")
  })

  it("shows the X Post section for an X/Twitter tweet", () => {
    store.canvas.tweet = { data: { source: "x" } }
    render(<Inspector />)
    expect(sectionTitles()).toContain("X Post")
    // Border + Padding are hidden when a tweet is present.
    expect(sectionTitles()).not.toContain("Border")
    expect(sectionTitles()).not.toContain("Padding")
  })

  it("labels the tweet section Bluesky for a bluesky source", () => {
    store.canvas.tweet = { data: { source: "bluesky" } }
    render(<Inspector />)
    expect(sectionTitles()).toContain("Bluesky Post")
  })

  it("merges a custom className on the aside", () => {
    const { container } = render(<Inspector className="x-cls" />)
    expect(container.querySelector("aside")).toHaveClass("x-cls")
  })
})
