import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { OpenControls } from "@/components/editor/top-bar/open-controls"

/**
 * `OpenControls` — dropdown with "Open image" and "Open project…". Props:
 * currentDraftName, onOpenImage, onOpenProject.
 */
function renderControls(
  props: Partial<React.ComponentProps<typeof OpenControls>> = {}
) {
  return render(
    <TooltipProvider>
      <OpenControls
        currentDraftName={null}
        onOpenImage={() => {}}
        onOpenProject={() => {}}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("OpenControls", () => {
  it("opens the menu and triggers onOpenImage", async () => {
    const onOpenImage = vi.fn()
    const user = userEvent.setup()
    renderControls({ onOpenImage })

    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("menuitem", { name: "Open image" }))
    expect(onOpenImage).toHaveBeenCalledOnce()
  })

  it("triggers onOpenProject from the menu", async () => {
    const onOpenProject = vi.fn()
    const user = userEvent.setup()
    renderControls({ onOpenProject })

    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("menuitem", { name: "Open project…" }))
    expect(onOpenProject).toHaveBeenCalledOnce()
  })
})
