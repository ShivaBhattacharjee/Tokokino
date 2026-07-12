import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `ScreenshotMockup` — a screenshot composited inside a device-frame PNG, with
 * a hover edit menu. Heavy children are stubbed.
 */
vi.mock("@/components/ui/shimmer-image", () => ({
  ShimmerImage: ({
    src,
    alt,
    className,
  }: {
    src: string
    alt?: string
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className={className} />
  ),
}))

vi.mock("@/components/editor/canvas/screenshot-edit-menu", () => ({
  ScreenshotEditMenu: () => <div data-testid="edit-menu" />,
}))

import { ScreenshotMockup } from "@/components/editor/canvas/screenshot-mockup"

type Props = React.ComponentProps<typeof ScreenshotMockup>

const baseProps = (over: Partial<Props> = {}): Props =>
  ({
    screenshot: "shot.png",
    mockupAsset: { deviceId: "iphone-15", src: "frame.png" },
    mockupSpec: { aspectRatio: "1 / 2", screen: { aspectRatio: "9 / 19" } },
    screenshotLayer: {
      zIndex: 0,
      opacity: 100,
      blendMode: "normal",
      hidden: false,
    },
    transform: "",
    mockupRotation: 0,
    screenshotOffset: { x: 0, y: 0 },
    screenshotAnchor: { x: 0, y: 0 },
    objectFit: "cover",
    isScreenshotSelected: false,
    isScreenshotDragging: false,
    activeTool: "pointer",
    placementDims: null,
    stageRef: createRef<HTMLDivElement>(),
    imageRef: createRef<HTMLImageElement>(),
    onSelect: () => {},
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {},
    onImageLoad: () => {},
    onCropClick: () => {},
    onReplaceFile: () => {},
    onDelete: () => {},
    ...over,
  }) as unknown as Props

describe("ScreenshotMockup", () => {
  it("renders the screenshot and the device frame images", () => {
    const { container } = render(<ScreenshotMockup {...baseProps()} />)
    const srcs = Array.from(container.querySelectorAll("img")).map((i) =>
      i.getAttribute("src")
    )
    expect(srcs).toContain("shot.png")
    expect(srcs).toContain("frame.png")
  })

  it("shows the edit menu with a pointer tool and placement dims", () => {
    render(
      <ScreenshotMockup
        {...baseProps({
          placementDims: { stageW: 200, stageH: 400, imgW: 180, imgH: 380 },
        })}
      />
    )
    expect(screen.getByTestId("edit-menu")).toBeInTheDocument()
  })

  it("hides the edit menu when hover actions are disabled", () => {
    render(
      <ScreenshotMockup
        {...baseProps({
          placementDims: { stageW: 200, stageH: 400, imgW: 180, imgH: 380 },
          showHoverActions: false,
        })}
      />
    )
    expect(screen.queryByTestId("edit-menu")).not.toBeInTheDocument()
  })

  it("renders a video element when the screenshot is a video src", () => {
    const { container } = render(
      <ScreenshotMockup
        {...baseProps({ screenshot: "data:video/mp4;base64,AAAA" })}
      />
    )
    const video = container.querySelector("video")
    expect(video).toBeTruthy()
    expect(video?.getAttribute("src")).toBe("data:video/mp4;base64,AAAA")
    // Frame PNG still renders as an image overlay.
    expect(
      Array.from(container.querySelectorAll("img")).map((i) =>
        i.getAttribute("src")
      )
    ).toContain("frame.png")
  })
})
