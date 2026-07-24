"use client"

import * as React from "react"

import { ShimmerBox } from "@/components/ui/shimmer-image"
import { shadowDropFilterPreviewCss } from "@/lib/editor/css-utils"
import {
  MAIN_BARE_LEFT_VAR,
  MAIN_BARE_TOP_VAR,
} from "@/lib/editor/live-preview-vars"
import { useEditor } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import type { EmptyFreePlacement } from "./canvas-empty-state"
import { frameFitStyle, framePositionTransform } from "./helpers"
import { InnerLightingOverlay } from "./inner-lighting-overlay"

type MediaPreparingStateProps = {
  /** Status label (e.g. "Preparing GIF…") — rendered as shimmer text. */
  label?: string
  aspectW?: number
  aspectH?: number
  innerLightingStyle?: React.CSSProperties | null
  screenshotAnchor: { x: number; y: number }
  screenshotOffset?: { x: number; y: number }
  /** Bare free placement — same as {@link CanvasEmptyState.freePlacement}. */
  freePlacement?: EmptyFreePlacement | null
  transform?: string
  shadowFilter?: string
  boxStyle?: React.CSSProperties
}

/**
 * Placeholder shown in the canvas box while an incoming media file is being
 * prepared (e.g. a GIF transcoding to video). Mirrors the positioned empty-state
 * box — same fit, tilt/scale transform and shadow — so the skeleton sits exactly
 * where the finished screenshot will land, then swaps in without a jump.
 */
export function MediaPreparingState({
  label = "Preparing…",
  aspectW,
  aspectH,
  innerLightingStyle,
  screenshotAnchor,
  screenshotOffset,
  freePlacement,
  transform,
  shadowFilter,
  boxStyle,
}: MediaPreparingStateProps) {
  const { aspect } = useEditor()
  const effectiveAw = aspectW ?? aspect.w ?? 16
  const effectiveAh = aspectH ?? aspect.h ?? 10
  const isPortrait = (effectiveAh || 10) >= (effectiveAw || 16)
  const fitStyle = frameFitStyle(
    `${effectiveAw || 16} / ${effectiveAh || 10}`,
    0,
    {
      fitFraction: isPortrait ? 0.7 : 0.8,
    }
  )

  const shellClass = cn(
    "absolute top-0 left-0 overflow-hidden select-none",
    "rounded-3xl border border-border/40"
  )

  const content = (
    <>
      <InnerLightingOverlay style={innerLightingStyle} />
      <ShimmerBox className="absolute inset-0 size-full rounded-3xl" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <span
          aria-hidden
          className="animate-text-shimmer bg-linear-to-r from-muted-foreground/45 via-foreground/70 to-muted-foreground/45 bg-clip-text text-xs font-medium text-transparent sm:text-sm dark:from-muted-foreground/40 dark:via-muted-foreground dark:to-muted-foreground/40"
        >
          {label}
        </span>
      </div>
    </>
  )

  if (freePlacement) {
    return (
      <div
        className="pointer-events-none relative h-full w-full"
        style={{ containerType: "size" }}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div
          data-editor-shadow-filter-target
          data-editor-shadow-filter-base={shadowFilter || ""}
          className={shellClass}
          style={{
            ...boxStyle,
            left: `var(${MAIN_BARE_LEFT_VAR}, ${freePlacement.left}px)`,
            top: `var(${MAIN_BARE_TOP_VAR}, ${freePlacement.top}px)`,
            width: freePlacement.width,
            height: freePlacement.height,
            maxWidth: "none",
            maxHeight: "none",
            transform: transform || undefined,
            transformOrigin: "center",
            transformStyle: "preserve-3d",
            filter: shadowDropFilterPreviewCss(shadowFilter) || undefined,
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none relative h-full w-full"
      style={{ containerType: "size" }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        data-editor-shadow-filter-target
        data-editor-shadow-filter-base={shadowFilter || ""}
        className={cn(shellClass, "max-h-full max-w-full")}
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
          filter: shadowDropFilterPreviewCss(shadowFilter) || undefined,
        }}
      >
        {content}
      </div>
    </div>
  )
}
