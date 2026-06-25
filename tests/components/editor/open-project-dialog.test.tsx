import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { OpenProjectDialog } from "@/components/editor/top-bar/open-project-dialog"

/**
 * `OpenProjectDialog` — lists saved drafts fetched from /api/drafts and opens
 * one on click.
 */
const drafts = [
  {
    id: "d1",
    name: "First Project",
    canvasCount: 1,
    updatedAt: new Date("2026-01-01").toISOString(),
    thumbnailUrl: null,
  },
  {
    id: "d2",
    name: "Second Project",
    canvasCount: 2,
    updatedAt: new Date("2026-02-01").toISOString(),
    thumbnailUrl: null,
  },
]

function mockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ drafts, hasMore: false }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("OpenProjectDialog", () => {
  it("lists the fetched drafts", async () => {
    vi.stubGlobal("fetch", mockFetch())
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={() => {}}
      />
    )

    expect(screen.getByText("Open project")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText("First Project")).toBeInTheDocument()
    )
    expect(screen.getByText("Second Project")).toBeInTheDocument()
  })

  it("opens a draft when its card is clicked", async () => {
    vi.stubGlobal("fetch", mockFetch())
    const onOpenDraft = vi.fn()
    const user = userEvent.setup()
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={onOpenDraft}
      />
    )

    await waitFor(() =>
      expect(screen.getByText("First Project")).toBeInTheDocument()
    )
    await user.click(screen.getByText("First Project").closest("button")!)
    expect(onOpenDraft).toHaveBeenCalledWith("d1")
  })

  it("offers a delete control per draft", async () => {
    vi.stubGlobal("fetch", mockFetch())
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={() => {}}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete First Project" })
      ).toBeInTheDocument()
    )
  })
})
