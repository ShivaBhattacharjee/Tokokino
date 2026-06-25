import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `TweetSection` — store-connected tweet card controls. Renders null without a
 * tweet; otherwise theme/font selects, visibility switches and a font-size
 * slider, all routing through `updateTweet`.
 */
type Tweet = {
  theme: string
  showAvatar: boolean
  showImages?: boolean
  showMetrics: boolean
  showTimestamp?: boolean
  showQuote?: boolean
  fontFamily?: string
  fontSize?: number
  data: { quotedTweet?: unknown }
}

const store = vi.hoisted(() => ({
  tweet: null as Tweet | null,
  updateTweet: vi.fn(),
}))

vi.mock("@/lib/editor/store", () => ({
  useActiveCanvasField: (selector: (c: unknown) => unknown) =>
    selector({ tweet: store.tweet }),
  useActiveCanvasId: () => "canvas-1",
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({ updateTweet: store.updateTweet }),
}))

vi.mock("@/components/editor/tweet-font-select", () => ({
  TweetThemeSelect: () => <div data-testid="theme-select" />,
  TweetFontSelect: () => <div data-testid="font-select" />,
}))

import { TweetSection } from "@/components/editor/inspector/tweet-section"

const baseTweet: Tweet = {
  theme: "light",
  showAvatar: false,
  showImages: true,
  showMetrics: true,
  showTimestamp: true,
  fontFamily: "Inter",
  fontSize: 16,
  data: {},
}

beforeEach(() => {
  store.tweet = { ...baseTweet, data: {} }
})
afterEach(() => vi.clearAllMocks())

describe("TweetSection", () => {
  it("renders nothing when there is no tweet", () => {
    store.tweet = null
    const { container } = render(<TweetSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the theme/font selects and visibility rows", () => {
    render(<TweetSection />)
    expect(screen.getByTestId("theme-select")).toBeInTheDocument()
    expect(screen.getByTestId("font-select")).toBeInTheDocument()
    expect(screen.getByText("Show avatar")).toBeInTheDocument()
    expect(screen.getByText("Stats")).toBeInTheDocument()
    expect(screen.getByText("Font size")).toBeInTheDocument()
  })

  it("toggles a visibility switch through updateTweet", async () => {
    const user = userEvent.setup()
    render(<TweetSection />)

    const row = screen.getByText("Show avatar").parentElement!
    await user.click(row.querySelector('[role="switch"]')!)
    expect(store.updateTweet).toHaveBeenCalledWith({ showAvatar: true })
  })

  it("hides the quoted-post row unless a quoted tweet exists", () => {
    render(<TweetSection />)
    expect(screen.queryByText("Quoted post")).not.toBeInTheDocument()
  })

  it("shows the quoted-post row when a quoted tweet exists", () => {
    store.tweet = { ...baseTweet, data: { quotedTweet: {} } }
    render(<TweetSection />)
    expect(screen.getByText("Quoted post")).toBeInTheDocument()
  })
})
