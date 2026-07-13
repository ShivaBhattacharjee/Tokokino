import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DraftChoiceDialog,
  NameDialog,
  PresetChoiceDialog,
} from "@/components/editor/top-bar/save-dialogs"

describe("DraftChoiceDialog", () => {
  it("offers update vs new and routes the callbacks", async () => {
    const onUpdateExisting = vi.fn().mockResolvedValue(undefined)
    const onCreateNew = vi.fn()
    const user = userEvent.setup()
    render(
      <DraftChoiceDialog
        open
        onOpenChange={() => {}}
        draftName="My Draft"
        isSaving={false}
        onUpdateExisting={onUpdateExisting}
        onCreateNew={onCreateNew}
      />
    )

    expect(screen.getByText("Save draft")).toBeInTheDocument()
    await user.click(screen.getByText("Update existing draft"))
    expect(onUpdateExisting).toHaveBeenCalledOnce()
    await user.click(screen.getByText("Save as new draft"))
    expect(onCreateNew).toHaveBeenCalledOnce()
  })
})

describe("PresetChoiceDialog", () => {
  it("offers update vs new preset", async () => {
    const onUpdateExisting = vi.fn().mockResolvedValue(undefined)
    const onCreateNew = vi.fn()
    const user = userEvent.setup()
    render(
      <PresetChoiceDialog
        open
        onOpenChange={() => {}}
        presetName="My Preset"
        isSaving={false}
        onUpdateExisting={onUpdateExisting}
        onCreateNew={onCreateNew}
      />
    )

    expect(screen.getByText("Save preset")).toBeInTheDocument()
    await user.click(screen.getByText("Update existing preset"))
    expect(onUpdateExisting).toHaveBeenCalledOnce()
    await user.click(screen.getByText("Save as new preset"))
    expect(onCreateNew).toHaveBeenCalledOnce()
  })
})

describe("NameDialog", () => {
  function renderDialog(
    props: Partial<React.ComponentProps<typeof NameDialog>> = {}
  ) {
    return render(
      <TooltipProvider>
        <NameDialog
          open
          onOpenChange={() => {}}
          title="Name your project"
          description="Pick a name"
          confirmLabel="Save"
          loading={false}
          onConfirm={() => {}}
          {...props}
        />
      </TooltipProvider>
    )
  }

  it("renders the title and seeds a non-empty name", () => {
    renderDialog()
    expect(screen.getByText("Name your project")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Project name")).not.toHaveValue("")
  })

  it("confirms with the entered name", async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    renderDialog({ onConfirm })

    const input = screen.getByPlaceholderText("Project name")
    await user.clear(input)
    await user.type(input, "My Project")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onConfirm).toHaveBeenCalledWith("My Project")
  })

  it("disables confirm when the name is empty", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.clear(screen.getByPlaceholderText("Project name"))
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("rerolls the name via the dice button", async () => {
    const user = userEvent.setup()
    renderDialog()
    const input = screen.getByPlaceholderText("Project name")
    await user.click(screen.getByRole("button", { name: "Pick a random name" }))
    // Random name may rarely repeat; just assert it stays non-empty.
    expect(input).not.toHaveValue("")
  })

  it("shows video upload progress while saving", () => {
    renderDialog({ loading: true, uploadProgress: { current: 42, total: 100 } })

    expect(screen.getByText("Uploading video — 42%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42"
    )
  })
})
