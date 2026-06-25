import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    theme: "light",
    setTheme: vi.fn(),
  }),
}))

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: null }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SettingsDialog } from "@/components/editor/settings/settings-dialog"

afterEach(() => vi.clearAllMocks())

describe("SettingsDialog", () => {
  it("renders the section nav when open", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByRole("button", { name: /Appearance/ })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Shortcuts/ })
    ).toBeInTheDocument()
  })

  it("shows the appearance (theme) section by default", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)
    expect(screen.getByText("Theme")).toBeInTheDocument()
  })

  it("switches to the export section", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog open onOpenChange={() => {}} />)
    await user.click(screen.getByRole("button", { name: /Export/ }))
    // Theme control is appearance-only, so it disappears after switching.
    expect(screen.queryByText("Theme")).not.toBeInTheDocument()
  })

  it("renders nothing when closed", () => {
    render(<SettingsDialog open={false} onOpenChange={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /Appearance/ })
    ).not.toBeInTheDocument()
  })
})
