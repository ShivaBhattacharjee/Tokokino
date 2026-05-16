"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { UploadCard } from "./upload-card"

type BoxEmptyStateProps = {
  isDragOver?: boolean
  onBrowse: () => void
  onCapture?: () => void
  url?: string
  onUrlChange?: (value: string) => void
}

export function BoxEmptyState({
  isDragOver = false,
  onBrowse,
  onCapture,
}: BoxEmptyStateProps) {
  return (
    <div
      data-drag-over={isDragOver}
      className={cn(
        "relative flex size-full items-center justify-center p-[6cqw] text-white transition-all",
        "data-[drag-over=true]:bg-primary/15 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/60"
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
        backgroundSize: "16px 16px",
        containerType: "inline-size",
      }}
    >
      <UploadCard
        fluid
        isDragOver={isDragOver}
        onBrowse={onBrowse}
        onCapture={onCapture ? (url) => onCapture() : undefined}
        className="w-full max-w-[80cqw]"
      />
    </div>
  )
}
