"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { formatBytes, formatCount } from "./shares-data"

export function StatsDialog({
  open,
  onOpenChange,
  savedCount,
  totalViews,
  usedBytes,
  storageLimit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedCount: number
  totalViews: number
  usedBytes: number
  storageLimit: number
}) {
  const storagePercent =
    storageLimit > 0 ? Math.min(100, (usedBytes / storageLimit) * 100) : 0
  const storageNearFull = storagePercent >= 90

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Library stats</DialogTitle>
          <DialogDescription>
            An overview of your shared screenshots and storage usage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border/70 bg-card/50 p-4">
            <p className="tabular text-2xl leading-none font-semibold">
              {formatCount(savedCount)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Saved shares</p>
          </div>
          <div className="rounded-md border border-border/70 bg-card/50 p-4">
            <p className="tabular text-2xl leading-none font-semibold">
              {formatCount(totalViews)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Total views</p>
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-card/50 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Storage</p>
            <p
              className={cn(
                "tabular text-xs font-medium text-muted-foreground",
                storageNearFull && "text-destructive"
              )}
            >
              {formatBytes(usedBytes)} / {formatBytes(storageLimit)}
            </p>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-500",
                storageNearFull && "bg-destructive"
              )}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {storageNearFull
              ? "Almost out of space. Delete shares to free up room."
              : `${Math.round(storagePercent)}% of 1 GB used`}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
