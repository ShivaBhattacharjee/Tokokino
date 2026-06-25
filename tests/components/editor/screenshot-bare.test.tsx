import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

/**
 * `ScreenshotBare` — the frame-less screenshot image + hover edit menu. Heavy
 * children (ShimmerImage, ScreenshotEditMenu) are stubbed.
 */
vi.mock("@/components/ui/shimmer-image", () => ({
  ShimmerImage: ({
    src,
    alt,
    className,
    style,
  }: {
    src: string
    alt: string
    className?: string
    style?: React.CSSProperties
    // eslint-disable-next-line @next/next/no-img-element
  }) => <img src={src} alt={alt} className={className} style={style} />,
}))

vi.mock("@/components/editor/canvas/screenshot-edit-menu", () => ({
  ScreenshotEditMenu: () => <div data-testid="edit-menu" />,
}))

import { ScreenshotBare } from "@/components/editor/canvas/screenshot-bare"

const baseProps = () => ({
  screenshot: "shot.png",
  imgStyle: { borderRadius: 8 },
  positionedStyle: null,
  transform: "",
  screenshotLeft: undefined,
  screenshotTop: undefined,
  placementDims: null,
  screenshotLayer: {
    zIndex: 0,
    opacity: 100,
    blendMode: "normal" as const,
    hidden: false,
  },
  isScreenshotSelected: false,
  isScreenshotDragging: false,
  suppressTransition: false,
  activeTool: "pointer" as const,
  selectedTextId: null,
  stageRef: createRef<HTMLDivElement>(),
  imageRef: createRef<HTMLImageElement>(),
  onContainerPointerDown: () => {},
  onSelect: () => {},
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onImageLoad: () => {},
  onCropClick: () => {},
  onReplaceFile: () => {},
  onDelete: () => {},
})

describe("ScreenshotBare", () => {
  it("renders the screenshot image", () => {
    render(<ScreenshotBare {...baseProps()} />)
    const img = screen.getByRole("img", { name: "Screenshot" })
    expect(img).toHaveAttribute("src", "shot.png")
  })

  it("applies the cover object-fit classes by default", () => {
    render(<ScreenshotBare {...baseProps()} objectFit="cover" />)
    expect(screen.getByRole("img")).toHaveClass("object-cover")
  })

  it("applies contain object-fit classes when requested", () => {
    render(<ScreenshotBare {...baseProps()} objectFit="contain" />)
    expect(screen.getByRole("img")).toHaveClass("object-contain")
  })

  it("shows the edit menu when a pointer tool is active with placement dims", () => {
    render(
      <ScreenshotBare
        {...baseProps()}
        placementDims={{ stageW: 100, stageH: 100, imgW: 50, imgH: 50 }}
      />
    )
    expect(screen.getByTestId("edit-menu")).toBeInTheDocument()
  })

  it("hides the edit menu without placement dims", () => {
    render(<ScreenshotBare {...baseProps()} placementDims={null} />)
    expect(screen.queryByTestId("edit-menu")).not.toBeInTheDocument()
  })
})
