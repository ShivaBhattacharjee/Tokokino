"use client"

import * as React from "react"

type TimelineWaveformProps = {
  /** Peaks 0–1 across the whole video source. */
  peaks: number[]
  /** How many buckets the finished waveform has (peaks may still be filling). */
  bucketCount: number
  /** Source range this clip plays, in ms. */
  startMs: number
  endMs: number
  durationMs: number
  muted?: boolean
}

// Points across the clip width; the SVG stretches them, so this is about curve
// smoothness, not pixel resolution.
const SAMPLES = 96
// The theme's matcha accent, fixed rather than themed: the band behind it is
// always dark, so the light-mode accent would be too deep to read.
const MATCHA = "oklch(0.84 0.15 145)"

export function TimelineWaveform({
  peaks,
  bucketCount,
  startMs,
  endMs,
  durationMs,
  muted,
}: TimelineWaveformProps) {
  const path = React.useMemo(() => {
    if (peaks.length === 0 || bucketCount === 0 || durationMs <= 0) return null
    const startFrac = Math.max(0, Math.min(1, startMs / durationMs))
    const endFrac = Math.max(startFrac, Math.min(1, endMs / durationMs))
    const points: string[] = []
    for (let i = 0; i <= SAMPLES; i++) {
      const frac = startFrac + ((endFrac - startFrac) * i) / SAMPLES
      const idx = Math.min(peaks.length - 1, Math.floor(frac * bucketCount))
      // Bottom-anchored: y runs 1 (baseline) up to 0 (full amplitude).
      const y = 1 - Math.max(0.02, peaks[idx] ?? 0)
      points.push(`${(i / SAMPLES) * 100},${y.toFixed(4)}`)
    }
    return `M0,1 L${points.join(" L")} L100,1 Z`
  }, [peaks, bucketCount, startMs, endMs, durationMs])

  const gradientId = `wf${React.useId().replace(/:/g, "")}`

  if (!path) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[60%] bg-linear-to-t from-black/65 via-black/35 to-transparent"
    >
      <svg
        viewBox="0 0 100 1"
        preserveAspectRatio="none"
        className="size-full"
        style={{ opacity: muted ? 0.35 : 1 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={MATCHA} stopOpacity="0.85" />
            <stop offset="100%" stopColor={MATCHA} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#${gradientId})`} />
      </svg>
    </div>
  )
}
