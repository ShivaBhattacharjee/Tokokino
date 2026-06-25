import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * `MobileHistoryButton` — popover with Undo / Redo / Reset. Props: open,
 * onOpenChange. Undo/Redo disable based on history length; Reset opens a
 * confirmation dialog.
 */
const store = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
  reset: vi.fn(),
  past: [] as unknown[],
  future: [] as unknown[],
}))

vi.mock("@/lib/editor/store", () => ({
  useEditorStore: (selector: (s: unknown) => unknown) =>
    selector({
      undo: store.undo,
      redo: store.redo,
      reset: store.reset,
      past: store.past,
      future: store.future,
    }),
}))

import { MobileHistoryButton } from "@/components/editor/mobile-controls/history-button"

beforeEach(() => {
  store.past = []
  store.future = []
})
afterEach(() => vi.clearAllMocks())

describe("MobileHistoryButton", () => {
  it("renders the trigger reflecting the open state", () => {
    render(<MobileHistoryButton open={false} onOpenChange={() => {}} />)
    const trigger = screen.getByRole("button", { name: "History" })
    expect(trigger).toHaveAttribute("aria-pressed", "false")
  })

  it("shows Undo/Redo/Reset actions when open", () => {
    render(<MobileHistoryButton open onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Reset all" })
    ).toBeInTheDocument()
  })

  it("disables Undo and Redo when there is no history", () => {
    render(<MobileHistoryButton open onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
  })

  it("undoes and closes the popover when Undo is clicked", async () => {
    store.past = [{}]
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<MobileHistoryButton open onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(store.undo).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("redoes when Redo is enabled and clicked", async () => {
    store.future = [{}]
    const user = userEvent.setup()
    render(<MobileHistoryButton open onOpenChange={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Redo" }))
    expect(store.redo).toHaveBeenCalledOnce()
  })

  it("opens a confirmation dialog and resets on confirm", async () => {
    const user = userEvent.setup()
    render(<MobileHistoryButton open onOpenChange={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Reset all" }))
    expect(screen.getByText("Reset to defaults?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(store.reset).toHaveBeenCalledOnce()
  })
})
