import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  UploadCard,
  DEFAULT_CAPTURE_SETTINGS,
} from "@/components/editor/canvas/upload-card"
import { DEFAULT_TWEET_SETTINGS } from "@/lib/editor/tweet-settings"

const VALIDATION_ERROR = "Enter a valid X or Bluesky post link"
const MALFORMED_BSKY_URLS = ["%", "%2", "%GG", "%E0%A4"].flatMap((value) => [
  `https://bsky.app/profile/${value}/post/abc123`,
  `https://bsky.app/profile/bsky.app/post/${value}`,
])

async function pasteUrl(user: ReturnType<typeof userEvent.setup>, url: string) {
  const input = screen.getByLabelText("Website URL")
  await user.click(input)
  await user.keyboard("{Control>}a{/Control}")
  await user.paste(url)
  return input
}

describe("UploadCard social post validation", () => {
  it.each(MALFORMED_BSKY_URLS)(
    "rejects malformed Bluesky input %s without loading or capturing",
    async (url) => {
      const user = userEvent.setup()
      const onLoadTweet = vi.fn().mockResolvedValue(undefined)
      const onCapture = vi.fn().mockResolvedValue(undefined)
      render(
        <UploadCard
          onBrowse={vi.fn()}
          onLoadTweet={onLoadTweet}
          onCapture={onCapture}
        />
      )

      const input = await pasteUrl(user, url)
      expect(input).toHaveValue(url)
      expect(input).toHaveAttribute("aria-invalid", "true")
      expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
      const submit = screen.getByRole("button", { name: "Capture Screenshot" })
      expect(submit).toBeDisabled()
      await user.click(submit)
      await user.click(input)
      await user.keyboard("{Enter}")

      expect(onLoadTweet).not.toHaveBeenCalled()
      expect(onCapture).not.toHaveBeenCalled()
    }
  )

  it.each([
    ["https://x.com/jack/status/20", "Load X post"],
    ["https://bsky.app/profile/bsky.app/post/abc123", "Load Bluesky post"],
    [
      "https://bsky.app/profile/did%3Aplc%3Aexample/post/abc%31%32%33",
      "Load Bluesky post",
    ],
  ])(
    "loads a valid social post %s after correcting malformed input",
    async (url, label) => {
      const user = userEvent.setup()
      const onLoadTweet = vi.fn().mockResolvedValue(undefined)
      const onCapture = vi.fn().mockResolvedValue(undefined)
      render(
        <UploadCard
          onBrowse={vi.fn()}
          onLoadTweet={onLoadTweet}
          onCapture={onCapture}
        />
      )

      await pasteUrl(user, "https://bsky.app/profile/%/post/abc123")
      expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
      const input = await pasteUrl(user, url)
      expect(input).toHaveAttribute("aria-invalid", "false")
      expect(screen.queryByText(VALIDATION_ERROR)).not.toBeInTheDocument()
      const submit = screen.getByRole("button", { name: label })
      expect(submit).toBeEnabled()
      await user.click(submit)

      expect(onLoadTweet).toHaveBeenCalledWith(url, DEFAULT_TWEET_SETTINGS)
      expect(onCapture).not.toHaveBeenCalled()
    }
  )

  it.each([
    "https://example.com/products",
    "https://bsky.app/profile/bsky.app",
    "https://example.com/bsky.app/profile/%/post/abc123",
    "https://example.com/?next=https://bsky.app/profile/bsky.app/post/%",
    "https://notbsky.app/profile/%/post/abc123",
    "https://example.com/bsky.app/profile/bsky.app/post/abc123",
    "https://example.com/?next=https://bsky.app/profile/bsky.app/post/abc123",
    "https://notbsky.app/profile/bsky.app/post/abc123",
  ])("captures an ordinary website %s", async (url) => {
    const user = userEvent.setup()
    const onLoadTweet = vi.fn().mockResolvedValue(undefined)
    const onCapture = vi.fn().mockResolvedValue(undefined)
    render(
      <UploadCard
        onBrowse={vi.fn()}
        onLoadTweet={onLoadTweet}
        onCapture={onCapture}
      />
    )

    const input = await pasteUrl(user, url)
    expect(input).toHaveAttribute("aria-invalid", "false")
    expect(screen.queryByText(VALIDATION_ERROR)).not.toBeInTheDocument()
    const submit = screen.getByRole("button", { name: "Capture Screenshot" })
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(onCapture).toHaveBeenCalledWith(url, DEFAULT_CAPTURE_SETTINGS)
    expect(onLoadTweet).not.toHaveBeenCalled()
  })

  it("blocks malformed Bluesky capture when social import is unavailable", async () => {
    const user = userEvent.setup()
    const onCapture = vi.fn().mockResolvedValue(undefined)
    render(<UploadCard onBrowse={vi.fn()} onCapture={onCapture} />)

    const input = await pasteUrl(user, "https://bsky.app/profile/%/post/abc123")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText(VALIDATION_ERROR)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Capture Screenshot" })
    ).toBeDisabled()
    await user.keyboard("{Enter}")
    expect(onCapture).not.toHaveBeenCalled()
  })
})
