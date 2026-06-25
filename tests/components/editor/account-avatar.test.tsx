import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AccountAvatar } from "@/components/editor/account-avatar"
import { fakeAvatarUrl, fakeName } from "../../fixtures"

/**
 * `AccountAvatar` — renders the user's image with `referrerPolicy="no-referrer"`,
 * falling back to a glyph when there's no src or the image errors. Props: src,
 * name, className, iconClassName.
 */

const avatarSrc = fakeAvatarUrl()
const freshSrc = fakeAvatarUrl()
const personName = fakeName()

describe("AccountAvatar", () => {
  it("renders an image when src is provided", () => {
    render(<AccountAvatar src={avatarSrc} name={personName} />)
    const img = screen.getByRole("img", { hidden: true })
    expect(img).toHaveAttribute("src", avatarSrc)
    expect(img).toHaveAttribute("alt", personName)
    expect(img).toHaveAttribute("referrerPolicy", "no-referrer")
  })

  it("falls back to 'Account' alt text when no name is given", () => {
    render(<AccountAvatar src={avatarSrc} />)
    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute(
      "alt",
      "Account"
    )
  })

  it("renders the glyph fallback when there is no src", () => {
    const { container } = render(<AccountAvatar />)
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("falls back to the glyph when the image errors", () => {
    const { container } = render(<AccountAvatar src={avatarSrc} />)
    fireEvent.error(screen.getByRole("img", { hidden: true }))
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("recovers the image when src changes after an error", () => {
    const { rerender } = render(<AccountAvatar src={avatarSrc} />)
    fireEvent.error(screen.getByRole("img", { hidden: true }))
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument()

    rerender(<AccountAvatar src={freshSrc} />)
    expect(screen.getByRole("img", { hidden: true })).toHaveAttribute(
      "src",
      freshSrc
    )
  })

  it("applies className to the wrapper and iconClassName to the fallback glyph", () => {
    const { container } = render(
      <AccountAvatar className="wrap-x" iconClassName="size-8" />
    )
    expect(container.firstElementChild).toHaveClass("wrap-x")
    expect(container.querySelector("svg")).toHaveClass("size-8")
  })
})
