import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EditableValue } from "@/components/editor/editable-value"

/**
 * `EditableValue` — a click-to-edit numeric field. Props: value, onChange,
 * min, max, step, suffix, className. Commits go through `parseEditorNumber`
 * (clamps + rejects non-numbers).
 */
describe("EditableValue", () => {
  it("renders the value and suffix as a button by default", () => {
    render(<EditableValue value={42} onChange={() => {}} suffix="px" />)

    const trigger = screen.getByRole("button", { name: /42px/ })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute("title", "Click to edit")
  })

  it("renders without a suffix by default", () => {
    render(<EditableValue value={7} onChange={() => {}} />)
    expect(screen.getByRole("button")).toHaveTextContent("7")
  })

  it("enters edit mode on click, focusing and pre-filling the input", async () => {
    const user = userEvent.setup()
    render(<EditableValue value={12} onChange={() => {}} />)

    await user.click(screen.getByRole("button"))

    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("12")
    expect(document.activeElement).toBe(input)
  })

  it("commits a typed value with Enter via onChange", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EditableValue value={10} onChange={onChange} />)

    await user.click(screen.getByRole("button"))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "55{Enter}")

    expect(onChange).toHaveBeenCalledWith(55)
    // leaves edit mode
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("commits on blur", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <EditableValue value={10} onChange={onChange} />
        <button type="button">outside</button>
      </>
    )

    await user.click(screen.getByRole("button", { name: /10/ }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "33")
    await user.click(screen.getByRole("button", { name: "outside" }))

    expect(onChange).toHaveBeenCalledWith(33)
  })

  it("clamps the committed value to [min, max]", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EditableValue value={50} onChange={onChange} min={0} max={100} />)

    await user.click(screen.getByRole("button"))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "999{Enter}")

    expect(onChange).toHaveBeenCalledWith(100)
  })

  it("reverts and skips onChange when Escape is pressed", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EditableValue value={20} onChange={onChange} />)

    await user.click(screen.getByRole("button"))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "77{Escape}")

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button")).toHaveTextContent("20")
  })

  it("does not call onChange for empty input", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EditableValue value={20} onChange={onChange} />)

    await user.click(screen.getByRole("button"))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not call onChange for non-numeric input", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<EditableValue value={20} onChange={onChange} />)

    await user.click(screen.getByRole("button"))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "abc{Enter}")

    expect(onChange).not.toHaveBeenCalled()
  })

  it("steps the draft up and down with arrow keys", async () => {
    const user = userEvent.setup()
    render(
      <EditableValue
        value={10}
        onChange={() => {}}
        step={5}
        min={0}
        max={100}
      />
    )

    await user.click(screen.getByRole("button"))
    const input = screen.getByRole("textbox")

    await user.type(input, "{ArrowUp}")
    expect(input).toHaveValue("15")

    await user.type(input, "{ArrowDown}{ArrowDown}")
    expect(input).toHaveValue("5")
  })

  it("clamps arrow-key stepping at the max", async () => {
    const user = userEvent.setup()
    render(
      <EditableValue
        value={98}
        onChange={() => {}}
        step={5}
        min={0}
        max={100}
      />
    )

    await user.click(screen.getByRole("button"))
    const input = screen.getByRole("textbox")
    await user.type(input, "{ArrowUp}")
    expect(input).toHaveValue("100")
  })

  it("syncs displayed value when the value prop changes while idle", () => {
    const { rerender } = render(<EditableValue value={1} onChange={() => {}} />)
    expect(screen.getByRole("button")).toHaveTextContent("1")

    rerender(<EditableValue value={2} onChange={() => {}} />)
    expect(screen.getByRole("button")).toHaveTextContent("2")
  })
})
