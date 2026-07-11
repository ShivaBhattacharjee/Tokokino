"use client"

import * as React from "react"
import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFilmLine,
  RiHardDrive2Line,
  RiLink,
  RiShareForwardLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  AnimationExportFormat,
  AnimationExportPhase,
} from "@/lib/editor/animation-export"
import type { ShareDialogState } from "./types"

export type AnimateShareFormat = Exclude<AnimationExportFormat, "gif"> | "gif"
export type AnimateShareResolution = "hd" | "fullhd" | "4k"

export type ShareProgressState = {
  phase: AnimationExportPhase | "uploading" | "idle"
  current: number
  total: number
  label: string
}

const PHASE_STEP: Record<ShareProgressState["phase"], number> = {
  idle: 0,
  preparing: 0.05,
  capturing: 0.15,
  encoding: 0.75,
  finishing: 0.92,
  uploading: 0.95,
}

function progressPercent(progress: ShareProgressState | null): number {
  if (!progress) return 8
  const { phase, current, total } = progress
  if (phase === "capturing" && total > 0) {
    // 15% → 75% while frames render
    return Math.min(75, 15 + (current / total) * 60)
  }
  if (phase === "encoding" && total > 0) {
    return Math.min(92, 75 + (current / Math.max(total, 1)) * 17)
  }
  return Math.round((PHASE_STEP[phase] ?? 0.1) * 100)
}

const FORMAT_OPTIONS: {
  id: AnimateShareFormat
  label: string
  hint: string
}[] = [
  { id: "mp4", label: "MP4", hint: "Best compatibility" },
  { id: "webm", label: "WebM", hint: "Smaller file" },
  { id: "gif", label: "GIF", hint: "No audio, heavier" },
]

const RESOLUTION_OPTIONS: {
  id: AnimateShareResolution
  label: string
  width: number
}[] = [
  { id: "hd", label: "HD", width: 1080 },
  { id: "fullhd", label: "Full HD", width: 1920 },
  { id: "4k", label: "4K", width: 3840 },
]

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

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const remaining = Math.max(0, limit - used)
  const nearFull = percent >= 90
  const full = remaining <= 0

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
          <RiHardDrive2Line className="size-3.5 text-muted-foreground" />
          Share storage
        </div>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            full
              ? "text-destructive"
              : nearFull
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
          )}
        >
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            full ? "bg-destructive" : nearFull ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {full
          ? "Storage is full. Delete older shares to free space."
          : `${formatBytes(remaining)} free of your 1 GB share quota.`}
      </p>
    </div>
  )
}

function ShareContent({
  status,
  url,
  error,
  copied,
  mediaKind,
  storage,
  format,
  resolution,
  progress,
  onFormatChange,
  onResolutionChange,
  onConfirmAnimateShare,
  onCopyLink,
  onRetry,
}: {
  status: ShareDialogState["status"]
  url: string | null
  error: string | null
  copied: boolean
  mediaKind: ShareDialogState["mediaKind"]
  storage: ShareDialogState["storage"]
  format: AnimateShareFormat
  resolution: AnimateShareResolution
  progress: ShareProgressState | null
  onFormatChange: (f: AnimateShareFormat) => void
  onResolutionChange: (r: AnimateShareResolution) => void
  onConfirmAnimateShare: () => void
  onCopyLink: (url: string) => Promise<void>
  onRetry: () => void
}) {
  const isPreparing = status === "preparing"
  const storageFull =
    storage != null && storage.limit > 0 && storage.used >= storage.limit
  const isAnimateConfigure = mediaKind === "animate" && status === "configure"
  const percent = progressPercent(progress)
  const frameDetail =
    progress && progress.phase === "capturing" && progress.total > 0
      ? `${progress.current} / ${progress.total} frames`
      : null

  return (
    <>
      <div className="px-1">
        <p className="text-sm font-medium">
          {mediaKind === "animate" ? "Share animation" : "Share screenshot"}
        </p>
        <p className="mt-1 text-xs/relaxed text-muted-foreground">
          {isPreparing
            ? mediaKind === "animate"
              ? "Encoding on your device, then uploading the share link."
              : "Preparing your public link…"
            : status === "ready"
              ? "Copy the public link or open the share page."
              : status === "error"
                ? "The link could not be prepared."
                : isAnimateConfigure
                  ? "Pick a format and resolution, then create a public link."
                  : "Create a public link for this canvas."}
        </p>
      </div>

      {isAnimateConfigure ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="px-0.5 text-[11px] font-medium text-muted-foreground">
              Format
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onFormatChange(opt.id)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left transition-colors",
                    format === opt.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <span className="block text-[12px] font-medium">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] opacity-80">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="px-0.5 text-[11px] font-medium text-muted-foreground">
              Resolution
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onResolutionChange(opt.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left transition-colors",
                    resolution === opt.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <span className="block text-[12px] font-medium">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] opacity-80">
                    {opt.width}px wide
                  </span>
                </button>
              ))}
            </div>
          </div>

          {storage ? (
            <StorageBar used={storage.used} limit={storage.limit} />
          ) : (
            <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/25 p-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2.5 w-40" />
            </div>
          )}

          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <RiFilmLine className="size-3.5 shrink-0" />
              Storage warning
            </span>
            <p className="mt-1 opacity-90">
              Animations use more of your 1 GB share quota than still images.
              Higher resolution and longer timelines produce larger files.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={storageFull || storage == null}
            onClick={onConfirmAnimateShare}
          >
            <RiShareForwardLine />
            <span>{storageFull ? "Storage full" : "Create share link"}</span>
          </Button>
        </div>
      ) : null}

      {isPreparing ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-secondary/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground">
                {progress?.label ?? "Working…"}
              </p>
              {frameDetail ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {frameDetail}
                </p>
              ) : mediaKind === "animate" ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {format.toUpperCase()} ·{" "}
                  {resolution === "fullhd" ? "1920px" : "1080px"}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-[12px] font-medium text-foreground tabular-nums">
              {Math.round(percent)}%
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label={progress?.label ?? "Share progress"}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
            <span>
              {progress?.phase === "uploading"
                ? "Almost done"
                : progress?.phase === "encoding"
                  ? "Encoding"
                  : progress?.phase === "capturing"
                    ? "Rendering"
                    : "Preparing"}
            </span>
          </div>
        </div>
      ) : null}

      {status === "ready" && url ? (
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/70 bg-secondary/40 p-2">
            <RiLink className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
              {url}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              className="min-w-0"
              onClick={() => void onCopyLink(url)}
            >
              {copied ? <RiCheckLine /> : <RiFileCopyLine />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button asChild size="lg" className="min-w-0">
              <a href={url} target="_blank" rel="noreferrer">
                <RiExternalLinkLine />
                <span>Open</span>
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs/relaxed text-destructive">
            {error ?? "Something went wrong."}
          </p>
          {storage ? (
            <StorageBar used={storage.used} limit={storage.limit} />
          ) : null}
          <Button size="lg" className="w-full" onClick={onRetry}>
            <RiShareForwardLine />
            <span>Try again</span>
          </Button>
        </div>
      ) : null}
    </>
  )
}

export function ShareControls({
  open,
  status,
  url,
  error,
  copied,
  mediaKind,
  storage,
  format,
  resolution,
  progress,
  onOpenChange,
  onShare,
  onFormatChange,
  onResolutionChange,
  onConfirmAnimateShare,
  onCopyLink,
  onRetry,
}: {
  open: boolean
  status: ShareDialogState["status"]
  url: string | null
  error: string | null
  copied: boolean
  mediaKind: ShareDialogState["mediaKind"]
  storage: ShareDialogState["storage"]
  format: AnimateShareFormat
  resolution: AnimateShareResolution
  progress: ShareProgressState | null
  onOpenChange: (open: boolean) => void
  onShare: () => void
  onFormatChange: (f: AnimateShareFormat) => void
  onResolutionChange: (r: AnimateShareResolution) => void
  onConfirmAnimateShare: () => void
  onCopyLink: (url: string) => Promise<void>
  onRetry: () => void
}) {
  // Controlled tooltip (own hover state), forced shut while the popover is open,
  // so it never flips between controlled/uncontrolled and warns.
  const [tooltipOpen, setTooltipOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip open={open ? false : tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (!open && status !== "preparing") onShare()
              }}
            >
              <RiShareForwardLine />
              <span className="hidden xl:inline">Share</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {mediaKind === "animate" ? "Share animation" : "Share screenshot"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="center"
        sideOffset={12}
        className="w-[min(calc(100vw-2rem),380px)] gap-3 rounded-2xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-md data-open:zoom-in-95 data-closed:zoom-out-95"
      >
        <ShareContent
          status={status}
          url={url}
          error={error}
          copied={copied}
          mediaKind={mediaKind}
          storage={storage}
          format={format}
          resolution={resolution}
          progress={progress}
          onFormatChange={onFormatChange}
          onResolutionChange={onResolutionChange}
          onConfirmAnimateShare={onConfirmAnimateShare}
          onCopyLink={onCopyLink}
          onRetry={onRetry}
        />
      </PopoverContent>
    </Popover>
  )
}

export function MobileShareDialog({
  open,
  status,
  url,
  error,
  copied,
  mediaKind,
  storage,
  format,
  resolution,
  progress,
  onOpenChange,
  onFormatChange,
  onResolutionChange,
  onConfirmAnimateShare,
  onCopyLink,
  onRetry,
}: {
  open: boolean
  status: ShareDialogState["status"]
  url: string | null
  error: string | null
  copied: boolean
  mediaKind: ShareDialogState["mediaKind"]
  storage: ShareDialogState["storage"]
  format: AnimateShareFormat
  resolution: AnimateShareResolution
  progress: ShareProgressState | null
  onOpenChange: (open: boolean) => void
  onFormatChange: (f: AnimateShareFormat) => void
  onResolutionChange: (r: AnimateShareResolution) => void
  onConfirmAnimateShare: () => void
  onCopyLink: (url: string) => Promise<void>
  onRetry: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(calc(100vw-2rem),380px)] gap-3 rounded-md p-3 md:hidden">
        <DialogTitle className="sr-only">
          {mediaKind === "animate" ? "Share animation" : "Share screenshot"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Create and copy a public link for this canvas.
        </DialogDescription>
        <ShareContent
          status={status}
          url={url}
          error={error}
          copied={copied}
          mediaKind={mediaKind}
          storage={storage}
          format={format}
          resolution={resolution}
          progress={progress}
          onFormatChange={onFormatChange}
          onResolutionChange={onResolutionChange}
          onConfirmAnimateShare={onConfirmAnimateShare}
          onCopyLink={onCopyLink}
          onRetry={onRetry}
        />
      </DialogContent>
    </Dialog>
  )
}
