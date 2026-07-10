import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import { TooltipProvider } from "@/components/ui/tooltip"
import { FeedbackDialog } from "@/components/editor/top-bar/feedback-dialog"

/**
 * `FeedbackDialog` — topbar button that opens the emoji + message modal and
 * POSTs the result to `/api/feedback`.
 */
function renderDialog() {
  return render(
    <TooltipProvider>
      <FeedbackDialog />
    </TooltipProvider>
  )
}

async function open() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Send feedback" }))
  await screen.findByRole("dialog")
  return user
}

function lastFetchBody(): Record<string, unknown> {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
  const call = fetchMock.mock.calls.at(-1)
  return JSON.parse((call?.[1] as RequestInit).body as string) as Record<
    string,
    unknown
  >
}

describe("FeedbackDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("disables Send until a rating or message is provided", async () => {
    renderDialog()
    await open()

    expect(screen.getByRole("button", { name: "Send Feedback" })).toBeDisabled()
  })

  it("enables Send once a message is typed", async () => {
    renderDialog()
    const user = await open()

    await user.type(
      screen.getByPlaceholderText("Write your feedback..."),
      "love it"
    )

    expect(screen.getByRole("button", { name: "Send Feedback" })).toBeEnabled()
  })

  it("enables Send once an emoji is picked, and toggles off when re-clicked", async () => {
    renderDialog()
    const user = await open()

    const angry = screen.getByRole("button", { name: "Angry" })
    await user.click(angry)
    expect(angry).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Send Feedback" })).toBeEnabled()

    await user.click(angry)
    expect(angry).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Send Feedback" })).toBeDisabled()
  })

  it("posts the 1-based rating and trimmed message, then shows a success toast", async () => {
    renderDialog()
    const user = await open()

    await user.click(screen.getByRole("button", { name: "Love it" }))
    await user.type(
      screen.getByPlaceholderText("Write your feedback..."),
      "  amazing  "
    )
    await user.click(screen.getByRole("button", { name: "Send Feedback" }))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST" })
    )
    // "Love it" is the fifth face → rating 5; message is trimmed.
    expect(lastFetchBody()).toEqual({ rating: 5, message: "amazing" })
  })

  it("omits an empty message from the payload", async () => {
    renderDialog()
    const user = await open()

    await user.click(screen.getByRole("button", { name: "Meh" }))
    await user.click(screen.getByRole("button", { name: "Send Feedback" }))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(lastFetchBody()).toEqual({ rating: 2 })
  })

  it("closes the dialog after a successful submission", async () => {
    renderDialog()
    const user = await open()

    await user.click(screen.getByRole("button", { name: "Angry" }))
    await user.click(screen.getByRole("button", { name: "Send Feedback" }))

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("shows an error toast and keeps the dialog open when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    )
    renderDialog()
    const user = await open()

    await user.click(screen.getByRole("button", { name: "Angry" }))
    await user.click(screen.getByRole("button", { name: "Send Feedback" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("resets the form when reopened after closing", async () => {
    renderDialog()
    const user = await open()

    await user.type(
      screen.getByPlaceholderText("Write your feedback..."),
      "draft text"
    )
    await user.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole("button", { name: "Send feedback" }))
    await screen.findByRole("dialog")
    expect(screen.getByPlaceholderText("Write your feedback...")).toHaveValue(
      ""
    )
  })
})
