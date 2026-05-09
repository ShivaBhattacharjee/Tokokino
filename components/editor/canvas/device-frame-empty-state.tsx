"use client"

import * as React from "react"
import { RiAddLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { DeviceMockupAsset, DEVICE_MOCKUP_SPECS } from "@/lib/mockups"

import { mockupScreenClipStyle, mockupScreenTransform } from "./helpers"

type DeviceMockupSpec = (typeof DEVICE_MOCKUP_SPECS)[string]

type DeviceFrameEmptyStateProps = {
  mockupAsset: DeviceMockupAsset
  mockupSpec: DeviceMockupSpec
  isDragOver: boolean
  onBrowse: () => void
}

export function DeviceFrameEmptyState({
  mockupAsset,
  mockupSpec,
  isDragOver,
  onBrowse,
}: DeviceFrameEmptyStateProps) {
  const screenRef = React.useRef<HTMLButtonElement | null>(null)
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

  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center">
      <div
        className="pointer-events-auto relative max-h-full max-w-full select-none"
        style={{
          aspectRatio: mockupSpec.aspectRatio,
          height: "100%",
          width: "auto",
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <button
            ref={screenRef}
            type="button"
            onClick={onBrowse}
            data-drag-over={isDragOver}
            aria-label="Add your screenshot"
            className={cn(
              "pointer-events-auto group relative w-full overflow-hidden bg-black text-white transition-all duration-200",
              "hover:bg-neutral-900",
              "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/60"
            )}
            style={{
              aspectRatio: mockupSpec.screen.aspectRatio,
              ...mockupScreenClipStyle(mockupSpec.screen, stageWidth),
              transform: mockupScreenTransform(mockupSpec.screen),
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
              backgroundSize: "16px 16px",
            }}
          >
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-[6%] px-[8%] text-center">
              <span
                className={cn(
                  "grid aspect-square w-[18%] min-w-7 max-w-16 place-items-center rounded-full border border-white/18 bg-white/10 text-white/82 transition-colors",
                  "group-hover:bg-white/16 group-hover:text-white",
                  "group-data-[drag-over=true]:border-primary/70 group-data-[drag-over=true]:bg-primary/20 group-data-[drag-over=true]:text-white"
                )}
              >
                <RiAddLine className="size-[60%]" />
              </span>
              <span className="flex flex-col items-center gap-[2%]">
                <span className="text-[clamp(0.65rem,2.6cqw,1.05rem)] font-medium tracking-[-0.02em] text-white/92">
                  Add screenshot
                </span>
                <span className="hidden text-[clamp(0.55rem,1.9cqw,0.78rem)] leading-tight text-white/52 sm:block">
                  Click, drop, or paste
                </span>
              </span>
            </span>
          </button>
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
