import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { StorageDialog } from "@/components/editor/storage-dialog"

/**
 * `StorageDialog` — shows draft/share storage pools fetched on open, plus an
 * unlimited presets row and a support contact.
 */
function mockFetch(storage: { used: number; limit: number }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ storage }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("StorageDialog", () => {
  it("renders the storage pools and support contact when open", () => {
    vi.stubGlobal("fetch", mockFetch({ used: 0, limit: 100 * 1024 * 1024 }))
    render(<StorageDialog open onOpenChange={() => {}} />)

    expect(screen.getByText("Storage")).toBeInTheDocument()
    expect(screen.getByText("Saved projects")).toBeInTheDocument()
    expect(screen.getByText("Shared images")).toBeInTheDocument()
    expect(screen.getByText("Custom presets")).toBeInTheDocument()
    expect(screen.getByText("hello@theshiva.xyz")).toBeInTheDocument()
  })

  it("does not render dialog content when closed", () => {
    vi.stubGlobal("fetch", mockFetch({ used: 0, limit: 1 }))
    render(<StorageDialog open={false} onOpenChange={() => {}} />)
    expect(screen.queryByText("Storage")).not.toBeInTheDocument()
  })

  it("shows formatted usage once the pools load", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ used: 5 * 1024 * 1024, limit: 100 * 1024 * 1024 })
    )
    render(<StorageDialog open onOpenChange={() => {}} />)

    await waitFor(() =>
      expect(screen.getAllByText(/5\.00 MB/).length).toBeGreaterThan(0)
    )
  })
})
