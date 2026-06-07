"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useEditor } from "@/lib/editor/store"
import type { TweetCardSettings } from "@/lib/editor/tweet-settings"
import { BoxEmptyState } from "./box-empty-state"
import { frameFitStyle, framePositionTransform } from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"
import type { EditorTool } from "@/lib/editor/store"
import type { CaptureDevice, CaptureSettings } from "./upload-card"

type CanvasEmptyStateProps = {
  isDragOver: boolean
  onBrowse: () => void
  onCapture?: (url: string, settings: CaptureSettings) => void | Promise<void>
  onLoadTweet?: (url: string, settings?: TweetCardSettings) => Promise<void>
  defaultCaptureDevice?: CaptureDevice
  captureStateKey?: string
  isActive?: boolean
  previewStyle?: React.CSSProperties
  compact?: boolean
  /** Override aspect ratio (falls back to active editor aspect). */
  aspectW?: number
  aspectH?: number
  /** Disable the outer padding wrapper (used when caller already provides one). */
  noOuterPadding?: boolean
  innerLightingStyle?: React.CSSProperties | null
  /** When provided, the empty state is positioned using the anchor/offset like device frames. */
  screenshotAnchor?: { x: number; y: number }
  screenshotOffset?: { x: number; y: number }
  /** The CSS transform string for tilt/scale (e.g. perspective + rotateX/Y/Z + scale). */
  transform?: string
  /** The shadow drop-filter for the screenshot box. */
  shadowFilter?: string
  /** Optional style overrides for the empty screenshot box (e.g. border effects). */
  boxStyle?: React.CSSProperties
  activeTool?: EditorTool
  isBeingDragged?: boolean
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void
}

export function CanvasEmptyState({
  isDragOver,
  onBrowse,
  onCapture,
  onLoadTweet,
  defaultCaptureDevice,
  captureStateKey,
  isActive = false,
  previewStyle,
  compact = false,
  aspectW,
  aspectH,
  noOuterPadding = false,
  innerLightingStyle,
  screenshotAnchor,
  screenshotOffset,
  transform,
  shadowFilter,
  boxStyle,
  activeTool,
  isBeingDragged,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
    const isClosing = trigger?.getAttribute("data-closing") === "true"
    if (isClosing) {
      // Clear the attribute so the next click works normally
      trigger?.removeAttribute("data-closing")
      return
    }
    trigger?.click()
  }

  // When screenshotAnchor is provided, use absolute positioning like frame
  // empty states do — the box is sized via container queries and positioned
  // with framePositionTransform so it follows the preset direction.
  const hasPosition = screenshotAnchor !== undefined
  if (hasPosition) {
    const boxAspect = `${effectiveAw} / ${effectiveAh}`
    const fitStyle = frameFitStyle(boxAspect, 0, {
      fitFraction: isPortrait ? 0.7 : 0.8,
    })
    return (
      <div
        className="pointer-events-none relative h-full w-full"
        style={{ containerType: "size" }}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          ref={rootRef}
          onClick={handleAreaClick}
          data-drag-over={isDragOver}
          data-active={isActive}
          data-editor-shadow-filter-target
          data-editor-shadow-filter-base={shadowFilter || ""}
          className={cn(
            "pointer-events-auto absolute top-0 left-0 max-h-full max-w-full select-none",
            "overflow-hidden rounded-3xl border border-border/30 transition-all duration-300 ease-out dark:border-white/8",
            "data-[drag-over=true]:border-primary/60 data-[drag-over=true]:ring-2 data-[drag-over=true]:ring-primary/35",
            onPointerDown && activeTool === "pointer"
              ? isBeingDragged
                ? "cursor-grabbing transition-none"
                : "cursor-grab"
              : "cursor-pointer"
          )}
          style={{
            ...fitStyle,
            ...boxStyle,
            left: "50%",
            top: "50%",
            transform: framePositionTransform({
              anchor: screenshotAnchor,
              offset: screenshotOffset ?? { x: 0, y: 0 },
              transform: transform ?? "",
            }),
            transformOrigin: "center",
            transformStyle: "preserve-3d",
            filter: shadowFilter || undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <InnerLightingOverlay style={innerLightingStyle} />
          <BoxEmptyState
            isDragOver={isDragOver}
            onBrowse={onBrowse}
            onCapture={onCapture}
            onLoadTweet={onLoadTweet}
            compact={useCompact}
            defaultCaptureDevice={defaultCaptureDevice}
            captureStateKey={captureStateKey}
          />
        </div>
      </div>
    )
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
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        ref={rootRef}
        onClick={handleAreaClick}
        style={{
          ...boxStyle,
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
        <InnerLightingOverlay style={innerLightingStyle} />
        <BoxEmptyState
          isDragOver={isDragOver}
          onBrowse={onBrowse}
          onCapture={onCapture}
          onLoadTweet={onLoadTweet}
          compact={useCompact}
          defaultCaptureDevice={defaultCaptureDevice}
          captureStateKey={captureStateKey}
        />
      </div>
    </div>
  )
}
