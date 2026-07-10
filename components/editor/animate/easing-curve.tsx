"use client"

import * as React from "react"

import {
  easingDotAt,
  easingSvgPath,
  type ClipEasingKind,
} from "@/lib/editor/clip-easing"
import { cn } from "@/lib/utils"

const PAD = 18
// Time for the dot to cross the whole curve at speed 1 (the full clip window).
const FULL_SWEEP_MS = 1150
// Constant loop length so every tile pulses at the same cadence; the leftover
// after the (speed-shortened) sweep is a hold at the end — that pause is what
// reads as "finishes early then waits".
const LOOP_MS = 1650

type EasingCurveProps = {
  kind: ClipEasingKind
  /** Run the moving-dot preview (true while the tile is hovered/focused). */
  animate?: boolean
  /** Clip speed (1..5): compresses the sweep so a faster clip zips to the end
   * then holds — so the preview reflects the current speed, not just the curve. */
  speed?: number
  className?: string
  strokeClassName?: string
  dotClassName?: string
}

/**
 * The little transition-curve thumbnail. Draws the easing curve (x = time, y =
 * eased output) and, while `animate` is on, sweeps a dot along it — faster when
 * `speed` is higher — so its motion reveals both the curve's shape ("how
 * instant") and how quickly the clip completes.
 */
export function EasingCurve({
  kind,
  animate = false,
  speed = 1,
  className,
  strokeClassName,
  dotClassName,
}: EasingCurveProps) {
  const path = React.useMemo(() => easingSvgPath(kind, 100, PAD), [kind])
  const [t, setT] = React.useState(0)

  const sweep = FULL_SWEEP_MS / Math.max(1, speed)
  React.useEffect(() => {
    if (!animate) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = (now - start) % LOOP_MS
      setT(elapsed <= sweep ? elapsed / sweep : 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, sweep])

  // The dot only shows while animating; `t` holds its last value between hovers
  // (harmless — a fresh hover restarts the sweep from its own timestamp).
  const dot = animate ? easingDotAt(kind, t, 100, PAD) : null

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-full w-full overflow-visible", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("stroke-foreground/40", strokeClassName)}
      />
      {dot && (
        <circle
          cx={dot.x}
          cy={dot.y}
          r={7}
          className={cn("fill-primary", dotClassName)}
        />
      )}
    </svg>
  )
}
