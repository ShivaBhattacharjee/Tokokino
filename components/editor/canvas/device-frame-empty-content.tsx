"use client"

import * as React from "react"
import { RiAddLine, RiCameraLine, RiGlobeLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

type DeviceFrameEmptyContentProps = {
  presentational?: boolean
  url?: string
  onUrlChange?: (value: string) => void
  onBrowse?: () => void
  onCapture?: () => void
}

export function DeviceFrameEmptyContent({
  presentational = false,
  url = "",
  onUrlChange,
  onBrowse,
  onCapture,
}: DeviceFrameEmptyContentProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-[4cqw] px-[7cqw] text-center",
        presentational && "pointer-events-none"
      )}
    >
      {presentational ? (
        <span aria-hidden className="flex flex-col items-center">
          <span className="grid aspect-square w-[9cqw] min-w-6 max-w-11 place-items-center rounded-full border border-white/18 bg-white/10 text-white/85">
            <RiAddLine className="size-[55%]" />
          </span>
          <span className="mt-[2.5cqw] block text-[clamp(0.7rem,2.6cqw,1rem)] font-medium tracking-[-0.02em] text-white/92">
            Add screenshot
          </span>
          <span className="mt-[0.6cqw] block text-[clamp(0.55rem,1.8cqw,0.78rem)] leading-snug text-white/52">
            Click, drop, or paste
          </span>
        </span>
      ) : (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onBrowse?.()
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
      )}

      <div className="mt-[1cqw] flex w-full flex-col items-center gap-[2.5cqw]">
        <div className="flex w-full items-center gap-[2cqw]">
          <span className="h-px flex-1 bg-white/12" />
          <span className="text-[clamp(0.5rem,1.5cqw,0.66rem)] tracking-[0.16em] text-white/40 uppercase">
            or capture a url
          </span>
          <span className="h-px flex-1 bg-white/12" />
        </div>
        {presentational ? (
          <div className="flex w-full flex-col gap-[1.5cqw] rounded-[3.5cqw] border border-white/12 bg-black/35 p-[2cqw] backdrop-blur-md">
            <span className="flex min-w-0 items-center gap-[1.5cqw] rounded-[2.5cqw] bg-white/[0.04] px-[3cqw] py-[2cqw] text-left">
              <RiGlobeLine className="size-[clamp(0.7rem,2.2cqw,1rem)] shrink-0 text-white/45" />
              <span className="min-w-0 flex-1 truncate text-[clamp(0.55rem,1.9cqw,0.82rem)] text-white/35">
                https://example.com
              </span>
            </span>
            <span className="flex w-full shrink-0 items-center justify-center gap-[1.5cqw] rounded-[2.5cqw] border border-white/14 bg-white/12 px-[3cqw] py-[2cqw] text-[clamp(0.55rem,1.9cqw,0.82rem)] font-semibold tracking-[-0.01em] text-white">
              <RiCameraLine className="size-[clamp(0.7rem,2.2cqw,1rem)]" />
              <span>Capture</span>
            </span>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onCapture?.()
            }}
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
                value={url}
                onChange={(e) => onUrlChange?.(e.target.value)}
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
        )}
      </div>
    </div>
  )
}

export const DEVICE_FRAME_EMPTY_VIRTUAL_WIDTH = 280
