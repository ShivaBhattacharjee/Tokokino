"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useEditor } from "@/lib/editor/store"
import { BoxEmptyState } from "./box-empty-state"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: () => void
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
  // Square (1:1) is treated like portrait — both get the 85% inset so the
  // empty-state box doesn't fill the entire canvas. Landscape uses the full area.
  const isPortrait = effectiveAh >= effectiveAw
  const rootRef = React.useRef<HTMLDivElement>(null)

  const useCompact = compact || isPortrait
  const handleAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!useCompact) return
    const target = e.target as HTMLElement
    if (target.closest("[data-upload-compact-trigger]")) return
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>(
      "[data-upload-compact-trigger]"
    )
    trigger?.click()
  }

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
      <div
        ref={rootRef}
        onClick={handleAreaClick}
        style={{
          ...(previewStyle ? { transition: "none", ...previewStyle } : null),
          ...(isPortrait
            ? { aspectRatio: `${effectiveAw} / ${effectiveAh}` }
            : null),
        }}
        data-drag-over={isDragOver}
        data-active={isActive}
        className={cn(
          "cursor-pointer overflow-hidden rounded-3xl border border-border/30 dark:border-white/8",
          "data-[drag-over=true]:border-primary/60 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35",
          isPortrait ? "h-auto max-h-[85%] w-[85%]" : "h-full w-full"
        )}
      >
        <BoxEmptyState
          isDragOver={isDragOver}
          onBrowse={onBrowse}
          onCapture={onCapture}
          compact={useCompact}
        />
      </div>
    </div>
  )
}
