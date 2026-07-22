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
  useSession: () => ({ data: null, isPending: false, refetch: vi.fn() }),
  authClient: {
    listAccounts: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SettingsDialog } from "@/components/editor/settings/settings-dialog"

afterEach(() => vi.clearAllMocks())

describe("SettingsDialog", () => {
  it("renders the section nav when open", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)
    expect(screen.getByRole("button", { name: /Profile/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Shortcuts/ })
    ).toBeInTheDocument()
  })

  it("keeps the desktop settings dialog at the wide layout", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)

    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass(
      "sm:max-w-5xl"
    )
  })

  it("keeps settings navigation above content until the desktop breakpoint", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)

    expect(
      document.querySelector('[data-slot="dialog-content"] > div')
    ).toHaveClass("lg:flex-row")
  })

  it("shows the profile section (with appearance) by default", () => {
    render(<SettingsDialog open onOpenChange={() => {}} />)
    expect(
      screen.getByText("Manage how you appear in Tokokino.")
    ).toBeInTheDocument()
    // Appearance / theme toggle lives inside Profile now.
    expect(screen.getByRole("button", { name: /Dark/ })).toBeInTheDocument()
  })

  it("switches to the export section", async () => {
    const user = userEvent.setup()
    render(<SettingsDialog open onOpenChange={() => {}} />)
    await user.click(screen.getByRole("button", { name: /Export/ }))
    expect(screen.getByText("Export filename format")).toBeInTheDocument()
  })

  it("renders nothing when closed", () => {
    render(<SettingsDialog open={false} onOpenChange={() => {}} />)
    expect(
      screen.queryByRole("button", { name: /Profile/ })
    ).not.toBeInTheDocument()
  })
})
