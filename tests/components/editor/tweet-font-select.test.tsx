import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

// Keep the font list light; it's covered by its own test.
vi.mock("@/components/editor/font-family-picker-list", () => ({
  FontFamilyPickerList: (props: { onSelect: (css: string) => void }) => (
    <button
      data-testid="font-list"
      onClick={() => props.onSelect("Roboto, sans-serif")}
    >
      pick font
    </button>
  ),
  resolveFontFamilyOption: (value: string) => ({
    id: "x",
    label: value === "" ? "X Default" : value,
    css: value || "system-ui",
    category: "system",
  }),
}))

import {
  TweetFontSelect,
  TweetThemeSelect,
} from "@/components/editor/tweet-font-select"
import { TWEET_THEME_OPTIONS } from "@/lib/editor/tweet-settings"

describe("TweetFontSelect", () => {
  it("opens the font list and forwards the selection", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<TweetFontSelect value="" onValueChange={onValueChange} />)

    await user.click(screen.getByRole("button"))
    await user.click(screen.getByTestId("font-list"))
    expect(onValueChange).toHaveBeenCalledWith("Roboto, sans-serif")
  })
})

describe("TweetThemeSelect", () => {
  it("shows the active theme label on the trigger", () => {
    const active = TWEET_THEME_OPTIONS[0]
    render(<TweetThemeSelect value={active.id} onValueChange={() => {}} />)
    expect(screen.getByText(active.label)).toBeInTheDocument()
  })

  it("opens the list and selects another theme", async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    const current = TWEET_THEME_OPTIONS[0]
    const other = TWEET_THEME_OPTIONS[1]
    render(
      <TweetThemeSelect value={current.id} onValueChange={onValueChange} />
    )

    await user.click(screen.getByRole("button"))
    await user.click(
      screen.getByRole("button", { name: new RegExp(other.label) })
    )
    expect(onValueChange).toHaveBeenCalledWith(other.id)
  })
})
