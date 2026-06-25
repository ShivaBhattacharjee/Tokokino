import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  FontFamilyPickerList,
  resolveFontFamilyOption,
} from "@/components/editor/font-family-picker-list"
import { FONT_FAMILIES } from "@/lib/editor/fonts"

/**
 * `FontFamilyPickerList` — searchable, category-filterable font list. Props:
 * value, onSelect, pinnedOptions, className, listClassName.
 */
describe("FontFamilyPickerList", () => {
  it("renders the category filters and a list of fonts", () => {
    render(<FontFamilyPickerList value="" onSelect={() => {}} />)
    for (const label of ["All", "Sans", "Serif", "Mono", "Script", "System"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    // first known font is listed
    expect(screen.getByText(FONT_FAMILIES[0].label)).toBeInTheDocument()
  })

  it("calls onSelect with the font css when a font is clicked", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<FontFamilyPickerList value="" onSelect={onSelect} />)

    await user.click(screen.getByText(FONT_FAMILIES[0].label))
    expect(onSelect).toHaveBeenCalledWith(FONT_FAMILIES[0].css)
  })

  it("filters fonts by search query", async () => {
    const user = userEvent.setup()
    render(<FontFamilyPickerList value="" onSelect={() => {}} />)

    await user.type(
      screen.getByPlaceholderText("Search fonts..."),
      "zzzznotafont"
    )
    expect(screen.getByText("No fonts found")).toBeInTheDocument()
  })

  it("filters by category", async () => {
    const user = userEvent.setup()
    render(<FontFamilyPickerList value="" onSelect={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Mono" }))
    // Every visible font row in the mono category shows the MONO tag.
    const monoTags = screen.getAllByText("mono")
    expect(monoTags.length).toBeGreaterThan(0)
  })

  it("shows pinned options ahead of the main list", () => {
    const pinned = [
      {
        id: "pinned-1",
        label: "My Pinned Font",
        css: "PinnedFont, sans-serif",
        category: "sans" as const,
      },
    ]
    render(
      <FontFamilyPickerList
        value=""
        onSelect={() => {}}
        pinnedOptions={pinned}
      />
    )
    expect(screen.getByText("My Pinned Font")).toBeInTheDocument()
  })
})

describe("resolveFontFamilyOption", () => {
  it("returns a pinned option when its css matches", () => {
    const pinned = [
      {
        id: "p",
        label: "Pinned",
        css: "Pinned, sans-serif",
        category: "sans" as const,
      },
    ]
    expect(resolveFontFamilyOption("Pinned, sans-serif", pinned)).toBe(
      pinned[0]
    )
  })

  it("returns the catalogue font when its css matches", () => {
    const font = FONT_FAMILIES[0]
    expect(resolveFontFamilyOption(font.css)).toBe(font)
  })

  it("falls back to a custom-font option for unknown css", () => {
    const result = resolveFontFamilyOption("Weird Custom, cursive")
    expect(result).toEqual({
      id: "custom-font",
      label: "Custom font",
      css: "Weird Custom, cursive",
      category: "system",
    })
  })
})
