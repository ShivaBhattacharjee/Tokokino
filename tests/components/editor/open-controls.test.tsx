import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { OpenControls } from "@/components/editor/top-bar/open-controls"

/**
 * `OpenControls` — the File menu: New/Open project, Add image/video, and the
 * offline toggle for the project currently open.
 */
function renderControls(
  props: Partial<React.ComponentProps<typeof OpenControls>> = {}
) {
  return render(
    <TooltipProvider>
      <OpenControls
        currentDraftName={null}
        onNewProject={() => {}}
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

  it("triggers the New project item", async () => {
    const onNewProject = vi.fn()
    const user = userEvent.setup()
    renderControls({ onNewProject })

    await user.click(screen.getByRole("button", { name: "File" }))
    await user.click(screen.getByRole("menuitem", { name: "New project" }))
    expect(onNewProject).toHaveBeenCalledOnce()
  })

  it("offers offline storage for the open project", async () => {
    const onToggleOffline = vi.fn()
    const user = userEvent.setup()
    renderControls({ onToggleOffline })

    await user.click(screen.getByRole("button", { name: "File" }))
    await user.click(
      screen.getByRole("menuitem", { name: "Make available offline" })
    )
    expect(onToggleOffline).toHaveBeenCalledOnce()
  })

  it("flips to removal once the open project is stored", async () => {
    const onToggleOffline = vi.fn()
    const user = userEvent.setup()
    renderControls({ onToggleOffline, isOffline: true })

    await user.click(screen.getByRole("button", { name: "File" }))
    expect(
      screen.queryByRole("menuitem", { name: "Make available offline" })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: "Turn off offline" }))
    expect(onToggleOffline).toHaveBeenCalledOnce()
  })

  it("locks the item while the offline copy is being written", async () => {
    const onToggleOffline = vi.fn()
    const user = userEvent.setup()
    renderControls({ onToggleOffline, isSavingOffline: true })

    await user.click(screen.getByRole("button", { name: "File" }))
    const item = screen.getByRole("menuitem", { name: "Saving offline…" })
    await user.click(item)
    expect(onToggleOffline).not.toHaveBeenCalled()
  })

  it("omits the offline item when the host does not wire it up", async () => {
    const user = userEvent.setup()
    renderControls()

    await user.click(screen.getByRole("button", { name: "File" }))
    expect(screen.getByRole("menuitem", { name: "Add video" })).toBeVisible()
    expect(
      screen.queryByRole("menuitem", { name: /offline/i })
    ).not.toBeInTheDocument()
  })
})
