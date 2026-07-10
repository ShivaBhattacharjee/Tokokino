import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  OpenProjectDialog,
  buildPageItems,
} from "@/components/editor/top-bar/open-project-dialog"

/**
 * `OpenProjectDialog` — lists saved drafts fetched from /api/drafts and opens
 * one on click. Supports Present/Animate filter and page pagination.
 */
const drafts = [
  {
    id: "d1",
    name: "First Project",
    canvasCount: 1,
    type: "style" as const,
    updatedAt: new Date("2026-01-01").toISOString(),
    createdAt: new Date("2026-01-01").toISOString(),
    thumbnailUrl: null,
  },
  {
    id: "d2",
    name: "Second Project",
    canvasCount: 2,
    type: "style" as const,
    updatedAt: new Date("2026-02-01").toISOString(),
    createdAt: new Date("2026-02-01").toISOString(),
    thumbnailUrl: null,
  },
]

function mockFetch(
  payload: {
    drafts: typeof drafts
    total?: number
    hasMore?: boolean
  } = { drafts }
) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        drafts: payload.drafts,
        total: payload.total ?? payload.drafts.length,
        hasMore: payload.hasMore ?? false,
      }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("buildPageItems", () => {
  it("shows a compact window with ellipsis for large page counts", () => {
    expect(buildPageItems(1, 1)).toEqual([1])
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageItems(1, 20)).toEqual([1, 2, "ellipsis", 20])
    expect(buildPageItems(10, 20)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
      20,
    ])
    expect(buildPageItems(50, 100)).toEqual([
      1,
      "ellipsis",
      49,
      50,
      51,
      "ellipsis",
      100,
    ])
    expect(buildPageItems(100, 100)).toEqual([1, "ellipsis", 99, 100])
  })
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
        onCreateNew={() => {}}
      />
    )

    expect(screen.getByText("Open project")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText("First Project")).toBeInTheDocument()
    )
    expect(screen.getByText("Second Project")).toBeInTheDocument()
  })

  it("requests the present filter by default", async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal("fetch", fetchMock)
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={() => {}}
        onCreateNew={() => {}}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = String(fetchMock.mock.calls[0]?.[0] ?? "")
    expect(url).toContain("type=style")
    expect(url).toContain("limit=9")
    expect(url).toContain("offset=0")
  })

  it("switches to animate projects when Animate is selected", async () => {
    const fetchMock = mockFetch({ drafts: [], total: 0 })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={() => {}}
        onCreateNew={() => {}}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    // Prefer the left-rail Animate control (avoid matching empty-state copy).
    await user.click(screen.getByRole("button", { name: /Animate.*timeline/i }))
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0] ?? ""))
      expect(urls.some((u) => u.includes("type=animate"))).toBe(true)
    })
  })

  it("paginates with numbered page buttons", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `d${i}`,
      name: `Project ${i}`,
      canvasCount: 1,
      type: "style" as const,
      updatedAt: new Date("2026-01-01").toISOString(),
      createdAt: new Date("2026-01-01").toISOString(),
      thumbnailUrl: null,
    }))
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url)
      const offset = Number(
        new URL(u, "http://x").searchParams.get("offset") ?? 0
      )
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            drafts:
              offset === 0
                ? many
                : [{ ...many[0], id: "d-page-2", name: "Page Two" }],
            total: 18,
            hasMore: offset === 0,
          }),
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId={null}
        onOpenDraft={() => {}}
        onCreateNew={() => {}}
      />
    )
    await waitFor(() =>
      expect(screen.getByText("Project 0")).toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: "Go to page 1" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Go to page 2" })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Go to page 2" }))
    await waitFor(() =>
      expect(screen.getByText("Page Two")).toBeInTheDocument()
    )
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
        onCreateNew={() => {}}
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
        onCreateNew={() => {}}
      />
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete First Project" })
      ).toBeInTheDocument()
    )
  })

  it("creates a new project immediately when there is no unsaved work", async () => {
    vi.stubGlobal("fetch", mockFetch({ drafts: [], total: 0 }))
    const onCreateNew = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <OpenProjectDialog
        open
        onOpenChange={onOpenChange}
        currentDraftId={null}
        hasUnsavedWork={false}
        onOpenDraft={() => {}}
        onCreateNew={onCreateNew}
      />
    )
    await user.click(screen.getByRole("button", { name: /New project/i }))
    expect(onCreateNew).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("warns before creating a new project when work would be discarded", async () => {
    vi.stubGlobal("fetch", mockFetch({ drafts: [], total: 0 }))
    const onCreateNew = vi.fn()
    const user = userEvent.setup()
    render(
      <OpenProjectDialog
        open
        onOpenChange={() => {}}
        currentDraftId="open-draft"
        hasUnsavedWork
        onOpenDraft={() => {}}
        onCreateNew={onCreateNew}
      />
    )
    await user.click(screen.getByRole("button", { name: /New project/i }))
    expect(onCreateNew).not.toHaveBeenCalled()
    expect(screen.getByText("Start a new project?")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /Discard & create new/i })
    )
    expect(onCreateNew).toHaveBeenCalledOnce()
  })
})
