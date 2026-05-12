"use client"

import * as React from "react"
import { RiAddLine, RiCameraLine, RiGlobeLine } from "@remixicon/react"

import { cn } from "@/lib/utils"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  isActive?: boolean
  previewStyle?: React.CSSProperties
}

export function CanvasEmptyState({
  isDragOver,
  onBrowse,
  isActive = false,
  previewStyle,
}: CanvasEmptyStateProps) {
  return (
    <div
      data-drag-over={isDragOver}
      data-active={isActive}
      className={cn(
        "pointer-events-auto relative flex h-full w-full items-center justify-center text-white transition-all duration-300",
        !previewStyle && "px-4 py-3 sm:px-6 md:px-8",
        "data-[drag-over=true]:scale-[1.005]"
      )}
    >
      <div
        data-drag-over={isDragOver}
        data-active={isActive}
        style={
          previewStyle
            ? { transition: "none", ...previewStyle }
            : undefined
        }
        className={cn(
          "group/empty relative flex w-full flex-col overflow-hidden rounded-3xl border backdrop-blur-md",
          !previewStyle && "max-w-[560px] transition-all duration-300",
          previewStyle && "h-full items-center justify-center",
          isActive
            ? "border-dashed border-border/70 bg-sidebar/90 ring-1 ring-primary/40"
            : "border-white/12 bg-black/30 hover:border-white/24",
          "data-[active=true]:bg-primary/10",
          "data-[drag-over=true]:border-primary/70 data-[drag-over=true]:bg-primary/8 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35"
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
            backgroundSize: "16px 16px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)",
          }}
        />

        <div
          className={cn(
            "relative z-10 flex w-full flex-col",
            previewStyle && "max-w-[560px]"
          )}
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onBrowse()
            }}
            aria-label="Browse for an image"
            className={cn(
              "group relative z-10 flex flex-col items-center justify-center px-6 pt-9 pb-7 text-center transition-colors sm:px-8 sm:pt-11 sm:pb-9 md:pt-14 md:pb-11",
              "focus-visible:outline-none"
            )}
          >
            <span
              className={cn(
                "mb-3 grid size-10 place-items-center rounded-full border border-white/16 bg-white/10 text-white/82 transition-all sm:size-11 md:mb-4 md:size-12",
                "group-hover:scale-105 group-hover:border-white/28 group-hover:bg-white/16 group-hover:text-white",
                "group-data-[drag-over=true]/empty:border-primary/60 group-data-[drag-over=true]/empty:bg-primary/20 group-data-[drag-over=true]/empty:text-white"
              )}
            >
              <RiAddLine className="size-5 sm:size-6" />
            </span>
            <span className="block text-xl leading-tight font-medium tracking-[-0.04em] text-balance text-white sm:text-2xl md:text-[1.7rem]">
              Add your screenshot
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-white/52 sm:text-xs md:text-[13px]">
              Drop, click to browse, or paste from clipboard
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55 sm:text-[11px]">
              <kbd className="font-mono text-white/80">⌘V</kbd>
              <span className="text-white/40">to paste</span>
            </span>
          </button>

          <div className="relative z-10 mt-1 flex items-center gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] tracking-[0.16em] text-white/35 uppercase">
              or capture a url
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="relative z-10 flex items-center gap-1.5 border-t border-white/10 bg-black/35 p-1.5 sm:gap-2 sm:p-2">
            <label className="flex min-h-9 flex-1 items-center gap-2 rounded-xl bg-white/[0.04] px-3 text-left transition-colors focus-within:bg-white/[0.08] sm:min-h-10 sm:rounded-2xl">
              <RiGlobeLine className="size-4 shrink-0 text-white/45" />
              <input
                type="text"
                inputMode="url"
                placeholder="https://example.com"
                aria-label="Website URL"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 focus:outline-none sm:text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <button
              type="button"
              className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/14 bg-white/12 px-3 text-[12px] font-semibold tracking-[-0.02em] text-white transition-colors hover:bg-white/20 active:bg-white/24 sm:min-h-10 sm:min-w-[100px] sm:rounded-2xl sm:px-4 sm:text-[13px]"
              onClick={(e) => e.stopPropagation()}
            >
              <RiCameraLine className="size-4" />
              <span className="hidden sm:inline">Capture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
