import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TweetUrlPopover } from "@/components/editor/canvas/tweet-url-popover"

/**
 * `TweetUrlPopover` — validates a pasted X/Bluesky link and calls onLoad.
 */
const VALID_URL = "https://x.com/sh17va/status/2057740573315125708"
const VALID_BSKY_URL = "https://bsky.app/profile/bsky.app/post/abc123"
const VALID_ENCODED_BSKY_URL =
  "https://bsky.app/profile/did%3Aplc%3Aexample/post/abc%31%32%33"
const VALIDATION_ERROR = "Enter a valid X or Bluesky post link"
const MALFORMED_BSKY_URLS = ["%", "%2", "%GG", "%E0%A4"].flatMap((value) => [
  `https://bsky.app/profile/${value}/post/abc123`,
  `https://bsky.app/profile/bsky.app/post/${value}`,
])

async function openPopover() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Embed" }))
  return user
}

describe("TweetUrlPopover", () => {
  it("does not show validation feedback for empty or whitespace-only input", async () => {
    render(
      <TweetUrlPopover onLoad={vi.fn()}>
        <button>Embed</button>
      </TweetUrlPopover>
    )
    const user = await openPopover()
    const input = screen.getByLabelText("Social post link")

    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(
      screen.queryByText("Paste an X or Bluesky post link")
    ).not.toBeInTheDocument()
    await user.paste("   ")
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(
      screen.queryByText("Paste an X or Bluesky post link")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Load post" })).toBeDisabled()
  })

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
    expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Load post" })).toBeDisabled()
  })

  it.each(MALFORMED_BSKY_URLS)(
    "rejects malformed Bluesky input %s without loading",
    async (url) => {
      const onLoad = vi.fn().mockResolvedValue(undefined)
      render(
        <TweetUrlPopover onLoad={onLoad}>
          <button>Embed</button>
        </TweetUrlPopover>
      )
      const user = await openPopover()
      const input = screen.getByLabelText("Social post link")
      await user.paste(url)

      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
      const submit = screen.getByRole("button", { name: "Load post" })
      expect(submit).toBeDisabled()
      await user.click(submit)
      await user.click(input)
      await user.keyboard("{Enter}")
      expect(onLoad).not.toHaveBeenCalled()
    }
  )

  it.each([VALID_URL, VALID_BSKY_URL, VALID_ENCODED_BSKY_URL])(
    "clears validation feedback and loads a valid link %s",
    async (url) => {
      const onLoad = vi.fn().mockResolvedValue(undefined)
      render(
        <TweetUrlPopover onLoad={onLoad}>
          <button>Embed</button>
        </TweetUrlPopover>
      )
      const user = await openPopover()

      const input = screen.getByLabelText("Social post link")
      await user.paste("https://bsky.app/profile/%/post/abc123")
      expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
      await user.clear(input)
      await user.paste(url)
      expect(input).toHaveAttribute("aria-invalid", "false")
      expect(screen.queryByText(VALIDATION_ERROR)).not.toBeInTheDocument()
      const submit = screen.getByRole("button", { name: "Load post" })
      expect(submit).toBeEnabled()

      await user.click(submit)
      expect(onLoad).toHaveBeenCalledWith(url)
    }
  )

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
