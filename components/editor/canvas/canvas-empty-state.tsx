"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { type CaptureSettings, UploadCard } from "./upload-card"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void
  isActive?: boolean
  previewStyle?: React.CSSProperties
}

export function CanvasEmptyState({
  isDragOver,
  onBrowse,
  onCapture,
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
        style={previewStyle ? { transition: "none", ...previewStyle } : undefined}
        className={cn(
          "group/empty relative flex w-full flex-col rounded-3xl",
          !previewStyle && "max-w-[400px] transition-all duration-300",
          previewStyle && "h-full items-center justify-center"
        )}
      >
        <div
          className={cn(
            "relative flex w-full flex-col overflow-hidden rounded-3xl border backdrop-blur-md",
            !previewStyle && "transition-all duration-300",
            previewStyle && "max-w-[400px]",
            isActive
              ? "border-dashed border-border/70 bg-sidebar/90 ring-1 ring-primary/40"
              : "border-white/12 bg-black/40 hover:border-white/20",
            "data-[active=true]:bg-primary/10",
            "data-[drag-over=true]:border-primary/70 data-[drag-over=true]:bg-primary/8 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35"
          )}
          data-drag-over={isDragOver}
          data-active={isActive}
        >
          {/* Dot grid texture */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
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
          <UploadCard
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={onCapture}
            showHint
          />
        </div>
      </div>
    </div>
  )
}
