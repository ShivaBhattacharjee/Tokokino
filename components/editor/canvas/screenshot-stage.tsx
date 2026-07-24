"use client"

import * as React from "react"

/**
 * The shared inner render skeleton for a screenshot box — used by BOTH the main
 * screenshot ({@link MainScreenshotRender}) and every slot
 * ({@link ScreenshotSlotRender}). Owning this here means the padding box, the
 * transformed image box, the dashed selection outline, and the Animate-mode
 * wrapper stay pixel-identical between the two; the callers only supply the
 * (legitimately different) outer container/positioning, the frame content, and
 * the edit menu.
 */
export function ScreenshotStage({
  padding,
  transformedBoxStyle,
  selectionRadius,
  contentTransform,
  showSelectionBorder,
  editMenu,
  children,
}: {
  /** Committed padding (0–240). Rendered through the live-preview var. */
  padding: number
  /** opacity / blend / radius for the transformed image box. */
  transformedBoxStyle: React.CSSProperties
  /** Selection-outline + transformed-box corner radius. */
  selectionRadius: number | string
  /** The 3D transform the selection outline must match. */
  contentTransform: string
  showSelectionBorder: boolean
  /** Floating pencil edit menu (already positioned by the caller), or null. */
  editMenu?: React.ReactNode
  /** The frame content (image / mockup / browser frame). */
  children: React.ReactNode
}) {
  const contentStyle: React.CSSProperties = {
    padding: `var(--editor-padding-preview, ${Math.max(0, Math.min(240, padding)) / 12}%)`,
  }
  return (
    <div className="absolute inset-0" style={contentStyle}>
      <div className="relative h-full w-full" style={transformedBoxStyle}>
        {/* Container selection for framed/empty boxes. Bare images draw their own
            ring on the image box in ScreenshotBare so contain doesn't leave a
            ring around letterboxed empty space. */}
        {showSelectionBorder ? (
          <div
            aria-hidden
            data-selection-border="true"
            className="pointer-events-none absolute inset-0 z-[60] outline-2 outline-offset-2 outline-[#9BCD64]/95 outline-dashed"
            style={{
              transform: contentTransform,
              transformStyle: "preserve-3d",
              borderRadius: selectionRadius,
            }}
          />
        ) : null}
        {/* Animate-mode wrapper. Driven by CSS vars AnimationLayer sets on the
            canvas node; defaults make it a visual no-op everywhere else. */}
        <div
          className="relative h-full w-full"
          style={{
            transform: "var(--anim-transform, none)",
            opacity: "var(--anim-opacity, 1)" as unknown as number,
            filter: "var(--anim-filter, none)",
            transformOrigin: "center",
          }}
        >
          {children}
        </div>
        {editMenu}
      </div>
    </div>
  )
}
