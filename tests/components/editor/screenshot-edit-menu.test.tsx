import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/editor/canvas/upload-card", () => ({
  UploadCard: () => <div data-testid="upload-card" />,
}))

import { ScreenshotEditMenu } from "@/components/editor/canvas/screenshot-edit-menu"

const baseProps = () => ({
  open: true,
  onOpenChange: vi.fn(),
  onCrop: vi.fn(),
  onReplaceFile: vi.fn(),
  onDelete: vi.fn(),
})

describe("ScreenshotEditMenu", () => {
  it("shows Crop and Delete actions when open", () => {
    render(<ScreenshotEditMenu {...baseProps()} />)
    expect(screen.getByRole("button", { name: "Crop" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  it("crops and closes", async () => {
    const props = baseProps()
    const user = userEvent.setup()
    render(<ScreenshotEditMenu {...props} />)
    await user.click(screen.getByRole("button", { name: "Crop" }))
    expect(props.onCrop).toHaveBeenCalledOnce()
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("deletes and closes", async () => {
    const props = baseProps()
    const user = userEvent.setup()
    render(<ScreenshotEditMenu {...props} />)
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(props.onDelete).toHaveBeenCalledOnce()
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("hides Delete when showDelete is false", () => {
    render(<ScreenshotEditMenu {...baseProps()} showDelete={false} />)
    expect(
      screen.queryByRole("button", { name: "Delete" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Crop" })).toBeInTheDocument()
  })

  it("renders only the trigger when closed", () => {
    render(<ScreenshotEditMenu {...baseProps()} open={false} />)
    expect(
      screen.queryByRole("button", { name: "Crop" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Edit screenshot" })
    ).toBeInTheDocument()
  })
})
