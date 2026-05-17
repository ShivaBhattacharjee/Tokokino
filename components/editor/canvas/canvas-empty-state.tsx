"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { EmptyStateBackdrop } from "./empty-state-backdrop"
import { type CaptureSettings, UploadCard } from "./upload-card"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void
  isActive?: boolean
  previewStyle?: React.CSSProperties
  compact?: boolean
}

export function CanvasEmptyState({
  isDragOver,
  onBrowse,
  onCapture,
  isActive = false,
  previewStyle,
  compact = false,
}: CanvasEmptyStateProps) {
  return (
    <div
      data-drag-over={isDragOver}
      data-active={isActive}
      className={cn(
        "pointer-events-auto relative flex h-full w-full items-center justify-center text-foreground transition-all duration-300",
        !previewStyle && "px-4 py-3 sm:px-6 md:px-8",
        "data-[drag-over=true]:scale-[1.005]"
      )}
    >
      <EmptyStateBackdrop
        style={previewStyle ? { transition: "none", ...previewStyle } : undefined}
        data-drag-over={isDragOver}
        data-active={isActive}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-3xl border border-border/30 dark:border-white/8",
          "data-[drag-over=true]:border-primary/60 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35"
        )}
      >
        <UploadCard
          compact={compact}
          isDragOver={isDragOver}
          onBrowse={onBrowse}
          onCapture={onCapture}
          showHint
          className={compact ? undefined : "w-full max-w-[400px]"}
        />
      </EmptyStateBackdrop>
    </div>
  )
}
