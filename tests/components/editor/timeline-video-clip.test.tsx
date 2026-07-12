import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TimelineVideoClip } from "@/components/editor/animate/timeline-video-clip"

const renderClip = (
  overrides: Partial<React.ComponentProps<typeof TimelineVideoClip>> = {}
) => {
  const props: React.ComponentProps<typeof TimelineVideoClip> = {
    left: 0,
    width: 160,
    selected: false,
    trimming: false,
    dragging: false,
    razorMode: false,
    muted: false,
    onPointerDownClip: vi.fn(),
    onPointerMoveClip: vi.fn(),
    onPointerUpClip: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onCopy: vi.fn(),
    onToggleMute: vi.fn(),
    onDeselect: vi.fn(),
    onMenuOpenChange: vi.fn(),
    children: <span>Video 5.0s</span>,
    ...overrides,
  }
  return { props, ...render(<TimelineVideoClip {...props} />) }
}

describe("TimelineVideoClip", () => {
  it("uses the shared scissor cursor while the razor is active", () => {
    const { container } = renderClip({ razorMode: true })
    const clip = container.querySelector(".group\\/video") as HTMLDivElement

    expect(clip.style.cursor).toContain("data:image/svg+xml")
    expect(clip.style.cursor).toContain("crosshair")
  })

  it("keeps filmstrip imagery from taking pointer events away from the menu trigger", () => {
    const { container } = renderClip({
      children: (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pointer-events-none" src="/filmstrip.jpg" alt="" />
      ),
    })

    expect(container.querySelector("img")).toHaveClass("pointer-events-none")
  })

  it("shows duplicate, copy, mute and delete actions in its context menu", () => {
    const { container } = renderClip()
    const clip = container.querySelector(".group\\/video") as HTMLDivElement

    expect(fireEvent.contextMenu(clip)).toBe(false)

    expect(screen.getByText("Duplicate")).toBeInTheDocument()
    expect(screen.getByText("Copy")).toBeInTheDocument()
    expect(screen.getByText("Mute")).toBeInTheDocument()
    expect(screen.getByText("Delete video clip")).toBeInTheDocument()
  })

  it("changes the context action to Unmute for a muted section", () => {
    const { container } = renderClip({ muted: true })
    const clip = container.querySelector(".group\\/video") as HTMLDivElement

    fireEvent.contextMenu(clip)

    expect(screen.getByText("Unmute")).toBeInTheDocument()
  })

  it("wires duplicate, copy, mute and delete actions", () => {
    const onDuplicate = vi.fn()
    const onCopy = vi.fn()
    const onToggleMute = vi.fn()
    const onDelete = vi.fn()
    const { container } = renderClip({
      onDuplicate,
      onCopy,
      onToggleMute,
      onDelete,
    })
    const clip = container.querySelector(".group\\/video") as HTMLDivElement

    fireEvent.contextMenu(clip)
    fireEvent.click(screen.getByText("Duplicate"))
    expect(onDuplicate).toHaveBeenCalledOnce()

    fireEvent.contextMenu(clip)
    fireEvent.click(screen.getByText("Copy"))
    expect(onCopy).toHaveBeenCalledOnce()

    fireEvent.contextMenu(clip)
    fireEvent.click(screen.getByText("Mute"))
    expect(onToggleMute).toHaveBeenCalledOnce()

    fireEvent.contextMenu(clip)
    fireEvent.click(screen.getByText("Delete video clip"))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
