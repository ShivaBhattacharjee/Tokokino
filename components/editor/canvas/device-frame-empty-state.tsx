"use client"

import * as React from "react"
import {
  RiAddLine,
  RiCameraLine,
  RiGlobeLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { EditorTool } from "@/lib/editor/store"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import { mockupScreenClipStyle, mockupScreenTransform } from "./helpers"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type DeviceFrameEmptyStateProps = {
  mockupAsset: DeviceMockupAsset
  mockupSpec: DeviceMockupSpec
  isDragOver: boolean
  onBrowse: () => void
  transform: string
  screenshotOffset: { x: number; y: number }
  isScreenshotDragging: boolean
  activeTool: EditorTool
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function DeviceFrameEmptyState({
  mockupAsset,
  mockupSpec,
  isDragOver,
  onBrowse,
  transform,
  screenshotOffset,
  isScreenshotDragging,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DeviceFrameEmptyStateProps) {
  const screenRef = React.useRef<HTMLDivElement | null>(null)
  const [stageWidth, setStageWidth] = React.useState<number | undefined>(
    undefined
  )

  React.useLayoutEffect(() => {
    const node = screenRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setStageWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const showUrlRow = (stageWidth ?? 0) >= 140

  return (
    <div
      className="pointer-events-none flex h-full w-full items-center justify-center"
      style={{
        transform: `translate(${screenshotOffset.x}px, ${screenshotOffset.y}px) ${transform}`,
      }}
    >
      <div
        className={cn(
          "pointer-events-auto relative max-h-full max-w-full select-none",
          isScreenshotDragging
            ? "cursor-grabbing transition-none"
            : "transition-transform duration-300 ease-out",
          activeTool === "pointer" && !isScreenshotDragging && "cursor-grab"
        )}
        style={{
          aspectRatio: mockupSpec.aspectRatio,
          height: "100%",
          width: "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div
            ref={screenRef}
            data-drag-over={isDragOver}
            className={cn(
              "pointer-events-auto relative w-full overflow-hidden bg-black text-white transition-all duration-200",
              "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/60"
            )}
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
              transform: mockupScreenTransform(mockupSpec.screen),
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "16px 16px",
              containerType: "inline-size",
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqw] px-[7cqw] text-center">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onBrowse()
                }}
                aria-label="Add your screenshot"
                className="group/add flex flex-col items-center focus:outline-none"
              >
                <span
                  className={cn(
                    "grid aspect-square w-[9cqw] min-w-6 max-w-11 place-items-center rounded-full border border-white/18 bg-white/10 text-white/85 transition-all",
                    "group-hover/add:scale-105 group-hover/add:border-white/30 group-hover/add:bg-white/16 group-hover/add:text-white"
                  )}
                >
                  <RiAddLine className="size-[55%]" />
                </span>
                <span className="mt-[2.5cqw] block text-[clamp(0.7rem,2.6cqw,1rem)] font-medium tracking-[-0.02em] text-white/92">
                  Add screenshot
                </span>
                <span className="mt-[0.6cqw] block text-[clamp(0.55rem,1.8cqw,0.78rem)] leading-snug text-white/52">
                  Click, drop, or paste
                </span>
              </button>

              {showUrlRow ? (
                <div className="mt-[1cqw] flex w-full flex-col items-center gap-[2.5cqw]">
                  <div className="flex w-full items-center gap-[2cqw]">
                    <span className="h-px flex-1 bg-white/12" />
                    <span className="text-[clamp(0.5rem,1.5cqw,0.66rem)] tracking-[0.16em] text-white/40 uppercase">
                      or capture a url
                    </span>
                    <span className="h-px flex-1 bg-white/12" />
                  </div>
                  <form
                    onSubmit={(e) => e.preventDefault()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="flex w-full flex-col gap-[1.5cqw] rounded-[3.5cqw] border border-white/12 bg-black/35 p-[2cqw] backdrop-blur-md transition-colors focus-within:border-white/28"
                  >
                    <label className="flex min-w-0 items-center gap-[1.5cqw] rounded-[2.5cqw] bg-white/[0.04] px-[3cqw] py-[2cqw] text-left transition-colors focus-within:bg-white/[0.08]">
                      <RiGlobeLine className="size-[clamp(0.7rem,2.2cqw,1rem)] shrink-0 text-white/45" />
                      <input
                        type="text"
                        inputMode="url"
                        placeholder="https://example.com"
                        aria-label="Website URL"
                        className="min-w-0 flex-1 bg-transparent text-[clamp(0.55rem,1.9cqw,0.82rem)] text-white placeholder:text-white/35 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                    <button
                      type="submit"
                      aria-label="Capture website"
                      className="flex w-full shrink-0 items-center justify-center gap-[1.5cqw] rounded-[2.5cqw] border border-white/14 bg-white/12 px-[3cqw] py-[2cqw] text-[clamp(0.55rem,1.9cqw,0.82rem)] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-white/22 active:bg-white/26"
                    >
                      <RiCameraLine className="size-[clamp(0.7rem,2.2cqw,1rem)]" />
                      <span>Capture</span>
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <img
          src={mockupAsset.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain select-none"
        />
      </div>
    </div>
  )
}
