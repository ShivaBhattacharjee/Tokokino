import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `MockupEmptyState` — empty device-mockup with the frame image + an inner
 * `BoxEmptyState` drop target. Heavy children/helpers are stubbed.
 */
vi.mock("@/components/editor/canvas/box-empty-state", () => ({
  BoxEmptyState: (props: { isDragOver?: boolean }) => (
    <div
      data-testid="box-empty-state"
      data-drag-over={String(Boolean(props.isDragOver))}
    />
  ),
}))

vi.mock("@/components/ui/shimmer-image", () => ({
  ShimmerImage: ({ src }: { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" data-testid="mockup-frame" />
  ),
}))

vi.mock("@/components/editor/canvas/helpers", () => ({
  framePositionedStyle: () => ({}),
  isDesktopMockup: () => false,
  mockupScreenClipStyle: () => ({}),
  mockupScreenTransform: () => "none",
}))

import { MockupEmptyState } from "@/components/editor/canvas/mockup-empty-state"

type Props = React.ComponentProps<typeof MockupEmptyState>

const baseProps = (over: Partial<Props> = {}): Props =>
  ({
    mockupAsset: { deviceId: "iphone", src: "iphone.png" },
    mockupSpec: {
      aspectRatio: "1 / 2",
      screen: { aspectRatio: "9 / 19" },
    },
    isDragOver: false,
    onBrowse: () => {},
    transform: "",
    mockupRotation: 0,
    screenshotOffset: { x: 0, y: 0 },
    screenshotAnchor: { x: 0, y: 0 },
    isScreenshotDragging: false,
    activeTool: "pointer" as const,
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {},
    ...over,
  }) as unknown as Props

describe("MockupEmptyState", () => {
  it("renders the device frame image and inner drop target", () => {
    render(<MockupEmptyState {...baseProps()} />)
    expect(screen.getByTestId("mockup-frame")).toHaveAttribute(
      "src",
      "iphone.png"
    )
    expect(screen.getByTestId("box-empty-state")).toBeInTheDocument()
  })

  it("forwards the drag-over state to the inner box", () => {
    render(<MockupEmptyState {...baseProps({ isDragOver: true })} />)
    expect(screen.getByTestId("box-empty-state")).toHaveAttribute(
      "data-drag-over",
      "true"
    )
  })
})
