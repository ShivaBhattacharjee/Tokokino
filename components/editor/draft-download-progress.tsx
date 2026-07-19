"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { RiDownloadCloud2Line } from "@remixicon/react"

export type DraftDownloadState = {
  /** Project name, if known yet. Null until the draft metadata resolves. */
  name: string | null
  /** Bytes downloaded so far. */
  current: number
  /** Total bytes, or 0 when the server did not report a length. */
  total: number
}

/** Format a byte count as a short human string (B / KB / MB / GB). */
function formatBytes(bytes: number) {
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
function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const s = Math.ceil(seconds)
  if (s < 60) return `${s}s left`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s left` : `${m}m left`
}

/**
 * Fixed bottom-right widget shown while a saved project's video is being
 * pulled down from R2 after the user opens it. Opening closes the picker
 * immediately, so this is the only thing telling the user the editor is busy
 * fetching media rather than frozen. Shows percent, downloaded/total size, and
 * a running ETA derived from average throughput.
 */
export function DraftDownloadProgress({
  download,
}: {
  download: DraftDownloadState | null
}) {
  // Timing anchor for the ETA — reset every time a fresh download begins. ETA
  // is derived in the effect (needs Date.now + the anchor) and kept in state so
  // render stays pure.
  const startRef = React.useRef<{ time: number; bytes: number } | null>(null)
  const [eta, setEta] = React.useState<string | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect -- ETA is time-derived, not computable in render */
  React.useEffect(() => {
    if (!download) {
      startRef.current = null
      setEta(null)
      return
    }
    if (!startRef.current) {
      startRef.current = { time: Date.now(), bytes: download.current }
      return
    }
    const start = startRef.current
    if (download.total > 0 && download.current > start.bytes) {
      const elapsed = (Date.now() - start.time) / 1000
      const speed = (download.current - start.bytes) / elapsed
      setEta(
        speed > 0
          ? formatEta((download.total - download.current) / speed)
          : null
      )
    }
  }, [download])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Rendered only after a client-side open, so the portal never runs on the server.
  if (!download) return null

  const { name, current, total } = download
  const hasTotal = total > 0
  const percent = hasTotal
    ? Math.min(100, Math.round((current / total) * 100))
    : 0

  const sizeLine = hasTotal
    ? `${formatBytes(current)} / ${formatBytes(total)}`
    : `${formatBytes(current)} downloaded`

  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-60 w-[300px] max-w-[calc(100vw-2rem)]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex flex-col gap-2.5 rounded-lg border border-border/70 bg-popover/95 p-3.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <RiDownloadCloud2Line className="size-4 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium">
              {name ? `Opening “${name}”` : "Downloading video"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {sizeLine}
              {eta ? ` · ${eta}` : ""}
            </p>
          </div>
          {hasTotal ? (
            <span className="shrink-0 text-[12px] font-semibold text-foreground tabular-nums">
              {percent}%
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label={name ? `Opening ${name}` : "Downloading video"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasTotal ? percent : undefined}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          {hasTotal ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-[draft-download-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
          )}
        </div>
      </div>
      <style>{`
        @keyframes draft-download-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>,
    document.body
  )
}
