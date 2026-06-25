import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { fakeAvatarUrl, fakeName } from "../../fixtures"

/**
 * `MobileAccountButton` — shows a Sign-in button when logged out, or an account
 * avatar with a popover menu (My Shares / Storage / Settings / Sign out) when
 * logged in.
 */
const mocks = vi.hoisted(() => ({
  session: null as { user: { name: string; image: string } } | null,
  push: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: mocks.session }),
  signOut: mocks.signOut,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/components/editor/settings/settings-dialog", () => ({
  SettingsDialog: () => null,
}))
vi.mock("@/components/editor/storage-dialog", () => ({
  StorageDialog: () => null,
}))

import { MobileAccountButton } from "@/components/editor/mobile-controls/account-button"

beforeEach(() => {
  mocks.session = null
})
afterEach(() => vi.clearAllMocks())

describe("MobileAccountButton", () => {
  it("renders a Sign-in button when logged out and routes to /login", async () => {
    const user = userEvent.setup()
    render(<MobileAccountButton />)
    const btn = screen.getByRole("button", { name: "Sign in" })
    await user.click(btn)
    expect(mocks.push).toHaveBeenCalledWith("/login")
  })

  it("renders an account trigger when logged in", () => {
    mocks.session = { user: { name: fakeName(), image: fakeAvatarUrl() } }
    render(<MobileAccountButton />)
    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument()
  })

  it("opens the menu and navigates to My Shares", async () => {
    mocks.session = { user: { name: fakeName(), image: fakeAvatarUrl() } }
    const user = userEvent.setup()
    render(<MobileAccountButton />)

    await user.click(screen.getByRole("button", { name: "Account" }))
    await user.click(screen.getByRole("button", { name: /My Shares/ }))
    expect(mocks.push).toHaveBeenCalledWith("/app/shares")
  })

  it("signs out from the menu", async () => {
    mocks.session = { user: { name: fakeName(), image: fakeAvatarUrl() } }
    const user = userEvent.setup()
    render(<MobileAccountButton />)

    await user.click(screen.getByRole("button", { name: "Account" }))
    await user.click(screen.getByRole("button", { name: /Sign out/ }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
