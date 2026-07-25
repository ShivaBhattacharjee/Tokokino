"use client"

import * as React from "react"
import { createPortal } from "react-dom"

/** Format a byte count as a short human string (B / KB / MB / GB). */
export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 100 || i <= 1 ? 0 : 1)} ${units[i]}`
}

/** Format remaining seconds as `Ns left` / `Nm Ns left`, or null if unknown. */
export function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const s = Math.ceil(seconds)
  if (s < 60) return `${s}s left`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s left` : `${m}m left`
}

/**
 * Running ETA for a byte transfer, derived from average throughput since the
 * transfer started. Kept in state rather than computed in render because it
 * depends on `Date.now()`.
 */
export function useTransferEta(
  active: boolean,
  current: number,
  total: number
) {
  const startRef = React.useRef<{ time: number; bytes: number } | null>(null)
  const [eta, setEta] = React.useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- ETA is time-derived, not computable in render */
  React.useEffect(() => {
    if (!active) {
      startRef.current = null
      setEta(null)
      return
    }
    if (!startRef.current) {
      startRef.current = { time: Date.now(), bytes: current }
      return
    }
    const start = startRef.current
    if (total > 0 && current > start.bytes) {
      const elapsed = (Date.now() - start.time) / 1000
      const speed = (current - start.bytes) / elapsed
      setEta(speed > 0 ? formatEta((total - current) / speed) : null)
    }
  }, [active, current, total])
  /* eslint-enable react-hooks/set-state-in-effect */

  return eta
}

/**
 * Fixed bottom-right widget for a background transfer the user kicked off from
 * a dialog. It sits above the dialog layer so the work stays visible while the
 * picker is still open, and is the only thing telling the user the editor is
 * busy rather than frozen.
 */
export function CornerProgressCard({
  icon,
  title,
  detail,
  percent,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  /** Null renders the indeterminate bar (no known total). */
  percent: number | null
}) {
  // Client components still prerender on the server, where there is no
  // document.body to portal into. Resolve the target after mount rather than
  // trusting every caller to hold this back until hydration.
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  /* eslint-disable-next-line react-hooks/set-state-in-effect -- document.body is not readable during render */
  React.useEffect(() => setContainer(document.body), [])

  if (!container) return null

  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-60 w-[300px] max-w-[calc(100vw-2rem)]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex flex-col gap-2.5 rounded-lg border border-border/70 bg-popover/95 p-3.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium">{title}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {detail}
            </p>
          </div>
          {percent !== null ? (
            <span className="shrink-0 text-[12px] font-semibold text-foreground tabular-nums">
              {percent}%
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          {percent !== null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-[corner-progress-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
          )}
        </div>
      </div>
      <style>{`
        @keyframes corner-progress-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>,
    container
  )
}
