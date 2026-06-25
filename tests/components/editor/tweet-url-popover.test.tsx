import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TweetUrlPopover } from "@/components/editor/canvas/tweet-url-popover"

/**
 * `TweetUrlPopover` — validates a pasted X/Bluesky link and calls onLoad.
 */
const VALID_URL = "https://x.com/sh17va/status/2057740573315125708"

async function openPopover() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Embed" }))
  return user
}

describe("TweetUrlPopover", () => {
  it("disables submit and flags invalid input", async () => {
    render(
      <TweetUrlPopover onLoad={vi.fn()}>
        <button>Embed</button>
      </TweetUrlPopover>
    )
    const user = await openPopover()

    const input = screen.getByLabelText("Social post link")
    await user.type(input, "not a url")

    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("button", { name: "Load post" })).toBeDisabled()
  })

  it("enables submit for a valid link and calls onLoad", async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined)
    render(
      <TweetUrlPopover onLoad={onLoad}>
        <button>Embed</button>
      </TweetUrlPopover>
    )
    const user = await openPopover()

    await user.type(screen.getByLabelText("Social post link"), VALID_URL)
    const submit = screen.getByRole("button", { name: "Load post" })
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(onLoad).toHaveBeenCalledWith(VALID_URL)
  })

  it("surfaces an error when onLoad rejects", async () => {
    const onLoad = vi.fn().mockRejectedValue(new Error("Post not found"))
    render(
      <TweetUrlPopover onLoad={onLoad}>
        <button>Embed</button>
      </TweetUrlPopover>
    )
    const user = await openPopover()

    await user.type(screen.getByLabelText("Social post link"), VALID_URL)
    await user.click(screen.getByRole("button", { name: "Load post" }))

    await waitFor(() =>
      expect(screen.getByText("Post not found")).toBeInTheDocument()
    )
  })
})
