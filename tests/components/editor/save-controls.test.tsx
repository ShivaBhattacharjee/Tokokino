import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import {
  MobileSaveDialog,
  SaveControls,
} from "@/components/editor/top-bar/save-controls"

const baseProps = {
  isDraftSaving: false,
  onOpenChange: () => {},
  onSaveAsPreset: () => {},
  onSaveAsDraft: () => {},
}

describe("SaveControls", () => {
  it("shows save options when the popover is open", () => {
    render(
      <TooltipProvider>
        <SaveControls open currentDraft={null} {...baseProps} />
      </TooltipProvider>
    )
    expect(screen.getByText("Save as preset")).toBeInTheDocument()
    expect(screen.getByText("Save as draft")).toBeInTheDocument()
  })

  it("calls onSaveAsPreset and onSaveAsDraft", async () => {
    const onSaveAsPreset = vi.fn()
    const onSaveAsDraft = vi.fn()
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <SaveControls
          open
          currentDraft={null}
          {...baseProps}
          onSaveAsPreset={onSaveAsPreset}
          onSaveAsDraft={onSaveAsDraft}
        />
      </TooltipProvider>
    )

    await user.click(screen.getByText("Save as preset"))
    expect(onSaveAsPreset).toHaveBeenCalledOnce()
    await user.click(screen.getByText("Save as draft"))
    expect(onSaveAsDraft).toHaveBeenCalledOnce()
  })

  it("labels the draft action as update and names the current draft", () => {
    render(
      <TooltipProvider>
        <SaveControls
          open
          currentDraft={{ id: "d1", name: "My Project", updatedAt: null }}
          {...baseProps}
        />
      </TooltipProvider>
    )
    expect(screen.getByText("Save draft")).toBeInTheDocument()
    expect(screen.getByText(/My Project/)).toBeInTheDocument()
  })
})

describe("MobileSaveDialog", () => {
  it("renders the save actions when open", () => {
    render(<MobileSaveDialog open currentDraft={null} {...baseProps} />)
    expect(screen.getByText("Save as preset")).toBeInTheDocument()
    expect(screen.getByText("Save as draft")).toBeInTheDocument()
  })

  it("shows a saving state on the draft action when saving", () => {
    render(
      <MobileSaveDialog open currentDraft={null} {...baseProps} isDraftSaving />
    )
    expect(screen.getByText("Saving…")).toBeInTheDocument()
  })
})
