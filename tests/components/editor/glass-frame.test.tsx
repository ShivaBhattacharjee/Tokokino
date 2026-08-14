import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/editor/store", () => ({
  useCanvasPreviewMode: () => false,
}))

import { GlassFrame } from "@/components/ui/glass-frame"
import {
  glassBackdropStyle,
  glassCornerStyle,
  glassScreenClipStyle,
} from "@/components/ui/glass-frame-styles"

describe("GlassFrame", () => {
  it("renders image media inside the glass screen", () => {
    const { container } = render(
      <GlassFrame frameId="glass-card" colorMode="dark" imageSrc="shot.png" />
    )

    expect(container.querySelector("img")?.getAttribute("src")).toBe("shot.png")
    expect(container.querySelector("[data-glass-frame-screen]")).toBeTruthy()
  })

  it("renders video media and keeps export chrome above it", () => {
    const { container } = render(
      <GlassFrame
        frameId="glass-card"
        colorMode="light"
        videoSrc="data:video/mp4;base64,AAAA"
      />
    )

    const video = container.querySelector("video")
    expect(video?.getAttribute("src")).toBe("data:video/mp4;base64,AAAA")
    expect(video?.getAttribute("preload")).toBe("metadata")
    expect(container.querySelector("[data-export-frame-chrome]")).toBeTruthy()
  })

  it("renders two real DOM rear layers for each stack treatment", () => {
    for (const frameId of ["glass-stack", "glass-stack-2"]) {
      const { container, unmount } = render(
        <GlassFrame frameId={frameId} colorMode="dark" imageSrc="shot.png" />
      )

      expect(
        container.querySelectorAll('[data-glass-frame-layer="rear"]')
      ).toHaveLength(2)
      unmount()
    }
  })

  it("gives Glass Card depth with a real blurred glass pane", () => {
    const { container } = render(
      <GlassFrame frameId="glass-card" colorMode="dark" imageSrc="shot.png" />
    )

    const rear = container.querySelector(
      '[data-glass-frame-layer="rear"]'
    ) as HTMLElement

    expect(
      container.querySelectorAll('[data-glass-frame-layer="rear"]')
    ).toHaveLength(1)
    expect(rear.style.backdropFilter).toBe("blur(18px) saturate(135%)")
    expect(rear.style.background).toContain("linear-gradient")
    expect(rear.style.border).not.toBe("")
  })

  it("uses the rear-card glass treatment for the front media rim", () => {
    const { container } = render(
      <GlassFrame frameId="glass-stack" colorMode="dark" imageSrc="shot.png" />
    )

    const rear = container.querySelector(
      '[data-glass-frame-layer="rear"]'
    ) as HTMLElement
    const shell = container.querySelector(
      "[data-glass-frame-shell]"
    ) as HTMLElement
    const screen = container.querySelector(
      "[data-glass-frame-screen]"
    ) as HTMLElement
    const chrome = container.querySelector(
      '[data-glass-frame-layer="chrome"]'
    ) as HTMLElement

    expect(shell.style.background).toBe(rear.style.background)
    expect(shell.style.backdropFilter).toBe(rear.style.backdropFilter)
    expect(parseFloat(screen.style.left)).toBeGreaterThan(0)
    expect(parseFloat(screen.style.top)).toBeGreaterThan(0)
    expect(parseFloat(screen.style.width)).toBeLessThan(100)
    expect(parseFloat(screen.style.height)).toBeLessThan(100)
    expect(chrome.style.borderWidth).toBe("")
    expect(chrome.style.boxShadow).not.toContain("rgba(24,30,40,0.92)")
    expect(chrome.style.boxShadow.match(/inset/g)).toHaveLength(1)
  })

  it("clips the screen and rim through one shared rounded shell", () => {
    const { container } = render(
      <GlassFrame frameId="glass-card" colorMode="dark" imageSrc="shot.png" />
    )

    const shell = container.querySelector(
      "[data-glass-frame-shell]"
    ) as HTMLElement
    const screen = container.querySelector(
      "[data-glass-frame-screen]"
    ) as HTMLElement
    const chrome = container.querySelector(
      '[data-glass-frame-layer="chrome"]'
    ) as HTMLElement

    expect(shell).toBeTruthy()
    expect(shell.contains(screen)).toBe(true)
    expect(shell.contains(chrome)).toBe(true)
    expect(shell.style.overflow).toBe("hidden")
    expect(screen.style.borderRadius).not.toBe("inherit")
    expect(chrome.style.borderRadius).toBe("inherit")
  })

  it("includes WebKit compositing and clipping fallbacks on glass layers", () => {
    const { container } = render(
      <GlassFrame frameId="glass-stack" colorMode="dark" imageSrc="shot.png" />
    )

    const root = container.firstElementChild as HTMLElement
    const rear = container.querySelector(
      '[data-glass-frame-layer="rear"]'
    ) as HTMLElement
    expect(root.style.isolation).toBe("isolate")
    expect(root.style.transform).toBe("translateZ(0)")
    expect(rear.style.backdropFilter).toBe("blur(18px) saturate(135%)")
    expect(glassBackdropStyle("blur(18px) saturate(135%)")).toEqual({
      backdropFilter: "blur(18px) saturate(135%)",
      WebkitBackdropFilter: "blur(18px) saturate(135%)",
    })
    expect(glassScreenClipStyle()).toEqual({
      WebkitMaskImage: "-webkit-radial-gradient(white, black)",
    })
  })

  it("gives every glass rect a continuous-curvature corner", () => {
    expect(glassCornerStyle(1.6667)).toEqual({
      borderRadius: "1.6667cqw",
      cornerShape: "var(--theme-corner-shape, superellipse(1.3))",
    })
  })

  it("keeps the screen corner concentric with the shell corner", () => {
    const { container } = render(
      <GlassFrame frameId="glass-card" colorMode="dark" imageSrc="shot.png" />
    )

    const shell = container.querySelector(
      "[data-glass-frame-shell]"
    ) as HTMLElement
    const screen = container.querySelector(
      "[data-glass-frame-screen]"
    ) as HTMLElement

    const shellRadius = parseFloat(shell.style.borderRadius)
    const screenRadius = parseFloat(screen.style.borderRadius)
    const inset = parseFloat(screen.style.left)

    expect(shellRadius - screenRadius).toBeCloseTo(inset, 5)
  })

  it("merges className so later Tailwind utilities win", () => {
    const { container } = render(
      <GlassFrame frameId="glass-card" className="block w-full" />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className.split(" ")).toContain("block")
    expect(root.className.split(" ")).not.toContain("inline-block")
  })
})
