"use client"

import * as React from "react"
import { RiAddLine, RiCameraLine, RiGlobeLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
}

export function CanvasEmptyState({ isDragOver, onBrowse }: CanvasEmptyStateProps) {
  return (
    <div
      data-drag-over={isDragOver}
      className={cn(
        "pointer-events-auto relative flex h-full w-full flex-col items-center justify-center px-4 py-3 text-center text-white transition-all duration-300 sm:px-6 md:px-8",
        "data-[drag-over=true]:scale-[1.01]"
      )}
    >
      <button
        type="button"
        className={cn(
          "group relative flex w-full max-w-[520px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-white/24 bg-black/12 px-5 py-3.5 backdrop-blur-md transition-all duration-300 focus-visible:border-white/55 focus-visible:ring-2 focus-visible:ring-white/20 sm:max-w-[540px] sm:rounded-[1.75rem] sm:px-7 sm:py-5 md:min-h-[190px] md:max-w-[560px] md:px-9 md:py-7",
          "hover:border-white/42 hover:bg-black/18",
          "data-[drag-over=true]:border-primary/80 data-[drag-over=true]:bg-primary/10 data-[drag-over=true]:ring-1 data-[drag-over=true]:ring-primary/40"
        )}
        data-drag-over={isDragOver}
        onClick={onBrowse}
        aria-label="Browse for an image"
      >
        <span className="mb-2 grid size-8 place-items-center rounded-full border border-white/18 bg-white/10 text-white/78 transition-colors group-hover:bg-white/14 group-hover:text-white sm:size-10 md:mb-3 md:size-11">
          <RiAddLine className="size-5 sm:size-7 md:size-8" />
        </span>
        <span className="space-y-1 sm:space-y-1.5 md:space-y-2">
          <span className="block text-xl leading-none font-medium tracking-[-0.055em] text-balance text-white sm:text-2xl md:text-3xl">
            Add your screenshot
          </span>
          <span className="block text-[10px] leading-4 text-white/56 sm:text-xs sm:leading-5 md:text-sm">
            Drop an image here, click to browse, or paste from clipboard.
          </span>
        </span>

        <span className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/18 px-2.5 py-1 text-[10px] text-white/58 sm:text-[11px] md:mt-4 md:text-xs">
          <kbd className="font-mono text-white/78">⌘V</kbd>
          paste
        </span>
      </button>

      <div className="my-2 flex w-full max-w-[400px] items-center gap-4 sm:my-3 md:my-4">
        <div className="h-px flex-1 bg-white/16" />
        <span className="text-xs text-white/42">or</span>
        <div className="h-px flex-1 bg-white/16" />
      </div>

      <div className="flex w-full max-w-[520px] gap-2 rounded-[1.15rem] border border-white/14 bg-black/14 p-1.5 backdrop-blur-md transition-colors focus-within:border-white/30 sm:max-w-[540px] sm:rounded-[1.35rem] sm:p-2 md:max-w-[560px]">
        <label className="flex min-h-10 flex-1 items-center gap-2.5 rounded-[0.9rem] px-3 text-left sm:min-h-11 sm:rounded-[1rem] md:min-h-12 md:rounded-[1.1rem]">
          <RiGlobeLine className="size-4 shrink-0 text-white/50 sm:size-5" />
          <input
            type="text"
            inputMode="url"
            placeholder="Enter website URL..."
            aria-label="Website URL"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/44 focus:outline-none sm:text-[15px]"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <button
          type="button"
          className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[0.9rem] border border-white/14 bg-white/14 px-3 text-[13px] font-semibold tracking-[-0.02em] text-white transition-colors hover:bg-white/20 active:bg-white/24 sm:min-h-11 sm:min-w-[112px] sm:rounded-[1rem] sm:px-4 md:min-h-12 md:min-w-[128px] md:rounded-[1.1rem] md:px-5"
          onClick={(e) => e.stopPropagation()}
        >
          <RiCameraLine className="size-4" />
          <span className="hidden sm:inline">Capture</span>
        </button>
      </div>
    </div>
  )
}
