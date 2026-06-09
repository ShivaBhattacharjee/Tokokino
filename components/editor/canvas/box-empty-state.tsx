"use client"

import * as React from "react"
import { RiAddLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import { EmptyStateBackdrop } from "./empty-state-backdrop"
import {
  UploadCard,
  type CaptureDevice,
  type CaptureSettings,
} from "./upload-card"

type BoxEmptyStateProps = {
  isDragOver?: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  url?: string
  onUrlChange?: (value: string) => void
  /** Force compact `+` trigger. Otherwise auto-detected by container width. */
  compact?: boolean
  /** Force compact trigger on phone viewports even when the frame itself is wide. */
  compactOnMobile?: boolean
  /** Counter-rotate inner content (used when the device mockup is rotated). */
  contentRotation?: number
  /** Static visual only — no popovers, inputs, or click handlers. */
  presentational?: boolean
  /** Use the normal fixed-size upload card instead of cqw fluid sizing. */
  plainWideCard?: boolean
  /** Default capture device for the inner UploadCard (e.g. "mobile" when the canvas frame is a phone). */
  defaultCaptureDevice?: CaptureDevice
  /** Frame orientation, used to seed a tablet capture as portrait vs landscape. */
  defaultCaptureOrientation?: "vertical" | "horizontal"
  captureStateKey?: string
}

export function BoxEmptyState({
  isDragOver = false,
  onBrowse,
  onCapture,
  compact = false,
  compactOnMobile = true,
  contentRotation = 0,
  presentational = false,
  plainWideCard = false,
  defaultCaptureDevice,
  defaultCaptureOrientation,
  captureStateKey,
  onLoadTweet,
}: BoxEmptyStateProps) {
  const handleCapture = onCapture
    ? (url: string, settings: CaptureSettings) => onCapture(url, settings)
    : undefined
  const rotationStyle = contentRotation
    ? { transform: `rotate(${contentRotation}deg)` }
    : undefined

  if (presentational) {
    return (
      <EmptyStateBackdrop
        className="pointer-events-none flex items-center justify-center p-[3cqw] text-foreground"
        style={{ containerType: "inline-size" }}
      >
        <span
          aria-hidden
          style={rotationStyle}
          className="grid size-[18cqw] max-h-16 min-h-7 max-w-16 min-w-7 place-items-center rounded-full border-2 border-primary bg-background/95 text-foreground shadow-lg dark:bg-neutral-900/95"
        >
          <RiAddLine className="size-[55%]" />
        </span>
      </EmptyStateBackdrop>
    )
  }

  return (
    <EmptyStateBackdrop
      data-drag-over={isDragOver}
      className={cn(
        "@container flex items-center justify-center p-[3cqw] text-foreground transition-all",
        "data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/40"
      )}
      style={{ containerType: "inline-size" }}
    >
      {compact ? (
        <div style={rotationStyle}>
          <UploadCard
            compact
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={handleCapture}
            onLoadTweet={onLoadTweet}
            showHint
            defaultDevice={defaultCaptureDevice}
            defaultOrientation={defaultCaptureOrientation}
            captureStateKey={captureStateKey}
          />
        </div>
      ) : (
        <>
          {/* Wide containers (desktop, browser, iPad horizontal) — full card */}
          <div
            className={cn(
              "@container hidden w-full max-w-[340px] @md:block",
              compactOnMobile && "max-md:!hidden"
            )}
            style={{ containerType: "inline-size", ...rotationStyle }}
          >
            <UploadCard
              fluid={!plainWideCard}
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              onCapture={handleCapture}
              onLoadTweet={onLoadTweet}
              showHint
              defaultDevice={defaultCaptureDevice}
              defaultOrientation={defaultCaptureOrientation}
              captureStateKey={captureStateKey}
              className="w-full"
            />
          </div>
          {/* Narrow containers (phone, iPad portrait) — compact + */}
          <div
            className={cn("@md:hidden", compactOnMobile && "max-md:!block")}
            style={rotationStyle}
          >
            <UploadCard
              compact
              isDragOver={isDragOver}
              onBrowse={onBrowse}
              onCapture={handleCapture}
              onLoadTweet={onLoadTweet}
              showHint
              defaultDevice={defaultCaptureDevice}
              defaultOrientation={defaultCaptureOrientation}
              captureStateKey={captureStateKey}
            />
          </div>
        </>
      )}
    </EmptyStateBackdrop>
  )
}
