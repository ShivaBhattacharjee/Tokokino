import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { OpenControls } from "@/components/editor/top-bar/open-controls"

/**
 * `OpenControls` — dropdown with "Open project", "Add image", and "Add video".
 */
function renderControls(
  props: Partial<React.ComponentProps<typeof OpenControls>> = {}
) {
  return render(
    <TooltipProvider>
      <OpenControls
        currentDraftName={null}
        onOpenImage={() => {}}
        onOpenVideo={() => {}}
        onOpenProject={() => {}}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("OpenControls", () => {
  it("opens the menu and triggers onOpenProject", async () => {
    const onOpenProject = vi.fn()
    const user = userEvent.setup()
    renderControls({ onOpenProject })

    await user.click(screen.getByRole("button", { name: "File" }))
    await user.click(screen.getByRole("menuitem", { name: "Open project" }))
    expect(onOpenProject).toHaveBeenCalledOnce()
  })

  it("triggers onOpenImage from the menu", async () => {
    const onOpenImage = vi.fn()
    const user = userEvent.setup()
    renderControls({ onOpenImage })

    await user.click(screen.getByRole("button", { name: "File" }))
    await user.click(screen.getByRole("menuitem", { name: "Add image" }))
    expect(onOpenImage).toHaveBeenCalledOnce()
  })

  it("triggers onOpenVideo from the menu", async () => {
    const onOpenVideo = vi.fn()
    const user = userEvent.setup()
    renderControls({ onOpenVideo })

    await user.click(screen.getByRole("button", { name: "File" }))
    await user.click(screen.getByRole("menuitem", { name: "Add video" }))
    expect(onOpenVideo).toHaveBeenCalledOnce()
  })
})
