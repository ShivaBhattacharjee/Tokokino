"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useEditor } from "@/lib/editor/store"
import { EmptyStateBackdrop } from "./empty-state-backdrop"
import { type CaptureSettings, UploadCard } from "./upload-card"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void
  isActive?: boolean
  previewStyle?: React.CSSProperties
  compact?: boolean
  /** Override aspect ratio (falls back to active editor aspect). */
  aspectW?: number
  aspectH?: number
  /** Disable the outer padding wrapper (used when caller already provides one). */
  noOuterPadding?: boolean
}

export function CanvasEmptyState({
  isDragOver,
  onBrowse,
  onCapture,
  isActive = false,
  previewStyle,
  compact = false,
  aspectW,
  aspectH,
  noOuterPadding = false,
}: CanvasEmptyStateProps) {
  const { aspect } = useEditor()
  const aw = aspectW ?? aspect.w ?? 16
  const ah = aspectH ?? aspect.h ?? 10
  const effectiveAw = aw || 16
  const effectiveAh = ah || 10
  const isPortrait = effectiveAh > effectiveAw
  const forcePortraitCompact = isPortrait

  return (
    <div
      data-drag-over={isDragOver}
      data-active={isActive}
      className={cn(
        "pointer-events-auto relative flex h-full w-full items-center justify-center text-foreground transition-all duration-300",
        !previewStyle && !noOuterPadding && "px-4 py-3 sm:px-6 md:px-8",
        "data-[drag-over=true]:scale-[1.005]"
      )}
    >
      <EmptyStateBackdrop
        style={{
          ...(previewStyle ? { transition: "none", ...previewStyle } : null),
          ...(forcePortraitCompact ? { aspectRatio: `${effectiveAw} / ${effectiveAh}` } : null),
        }}
        data-drag-over={isDragOver}
        data-active={isActive}
        className={cn(
          "flex items-center justify-center rounded-3xl border border-border/30 dark:border-white/8",
          "data-[drag-over=true]:border-primary/60 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35",
          forcePortraitCompact
            ? "h-auto max-h-[85%] w-[85%]"
            : "h-full w-full"
        )}
      >
        <UploadCard
          compact={compact || forcePortraitCompact}
          isDragOver={isDragOver}
          onBrowse={onBrowse}
          onCapture={onCapture}
          showHint
          className={compact || forcePortraitCompact ? undefined : "w-full max-w-[400px]"}
        />
      </EmptyStateBackdrop>
    </div>
  )
}
