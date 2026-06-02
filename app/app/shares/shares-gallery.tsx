"use client"

import * as React from "react"
import {
  RiCalendarLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEyeLine,
  RiGalleryLine,
  RiLinkM,
  RiSortDesc,
} from "@remixicon/react"
import Link from "next/link"
import { toast } from "sonner"

import { BrandLogo } from "@/components/editor/brand-logo"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SerializedShare = {
  id: string
  imageUrl: string
  viewCount: number
  sizeBytes: number
  createdAt: string
}

type DateFilterId = "all" | "today" | "week" | "month" | "3months"
type SortFilterId = "latest" | "oldest" | "mostViewed" | "leastViewed"

type FilterRange = { from: Date; to?: Date } | undefined

const DATE_FILTERS: {
  id: DateFilterId
  label: string
  getRange: () => FilterRange
}[] = [
  {
    id: "all",
    label: "All time",
    getRange: () => undefined,
  },
  {
    id: "today",
    label: "Today",
    getRange: () => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return { from: d, to: new Date() }
    },
  },
  {
    id: "week",
    label: "Last 7 days",
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 7)
      return { from, to }
    },
  },
  {
    id: "month",
    label: "Last 30 days",
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 30)
      return { from, to }
    },
  },
  {
    id: "3months",
    label: "Last 3 months",
    getRange: () => {
      const to = new Date()
      const from = new Date()
      from.setMonth(from.getMonth() - 3)
      return { from, to }
    },
  },
]

const SORT_FILTERS: { id: SortFilterId; label: string }[] = [
  { id: "latest", label: "Latest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "mostViewed", label: "Most viewed" },
  { id: "leastViewed", label: "Least viewed" },
]

const PAGE_SIZE = 9

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 100 || i <= 1 ? 0 : 1)} ${units[i]}`
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function buildPageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total]
  if (current >= total - 3)
    return [1, "…", total - 4, total - 3, total - 2, total - 1, total]
  return [1, "…", current - 1, current, current + 1, "…", total]
}

export function SharesGallery({
  shares: initialShares,
  storageUsed,
  storageLimit,
}: {
  shares: SerializedShare[]
  storageUsed: number
  storageLimit: number
}) {
  const [shares, setShares] = React.useState(initialShares)
  const [usedBytes, setUsedBytes] = React.useState(storageUsed)
  const [page, setPage] = React.useState(1)
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = React.useState(false)
  const [deletingAll, setDeletingAll] = React.useState(false)
  const [dateFilter, setDateFilter] = React.useState<DateFilterId>("all")
  const [sortFilter, setSortFilter] = React.useState<SortFilterId>("latest")

  const filtered = React.useMemo(() => {
    const filterRange = DATE_FILTERS.find(
      (p) => p.id === dateFilter
    )?.getRange()
    const dateFiltered = !filterRange?.from
      ? shares.slice()
      : shares.filter((s) => {
          const from = startOfDay(filterRange.from)
          const to = endOfDay(filterRange.to ?? filterRange.from)
          const d = new Date(s.createdAt)
          return d >= from && d <= to
        })

    return dateFiltered.sort((a, b) => {
      const newestFirst =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

      if (sortFilter === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      if (sortFilter === "mostViewed") {
        return b.viewCount - a.viewCount || newestFirst
      }

      if (sortFilter === "leastViewed") {
        return a.viewCount - b.viewCount || newestFirst
      }

      return newestFirst
    })
  }, [shares, dateFilter, sortFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const handleDateFilterChange = (id: DateFilterId) => {
    setDateFilter(id)
    setPage(1)
  }

  const handleSortFilterChange = (id: SortFilterId) => {
    setSortFilter(id)
    setPage(1)
  }

  const dateFilterLabel =
    DATE_FILTERS.find((p) => p.id === dateFilter)?.label ?? "All time"
  const sortFilterLabel =
    SORT_FILTERS.find((p) => p.id === sortFilter)?.label ?? "Latest first"
  const dateFilterApplied = dateFilter !== "all"
  const sortFilterApplied = sortFilter !== "latest"

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/share/${id}`
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied"))
  }

  const handleDownload = (id: string) => {
    const a = document.createElement("a")
    a.href = `/api/share/${id}/download`
    a.download = `tokokino-share-${id}.png`
    a.click()
  }

  const handleDeleteConfirm = async (id: string) => {
    setDeleteTarget(null)
    const snapshot = shares
    const usedSnapshot = usedBytes
    const removed = shares.find((s) => s.id === id)
    setShares((prev) => prev.filter((s) => s.id !== id))
    setUsedBytes((prev) => Math.max(0, prev - (removed?.sizeBytes || 0)))
    try {
      const res = await fetch(`/api/share/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Screenshot deleted")
    } catch {
      setShares(snapshot)
      setUsedBytes(usedSnapshot)
      toast.error("Could not delete screenshot")
    }
  }

  const handleDeleteAll = async () => {
    setDeleteAllOpen(false)
    const snapshot = shares
    const usedSnapshot = usedBytes
    setShares([])
    setUsedBytes(0)
    setDeletingAll(true)
    try {
      const res = await fetch("/api/share", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("All screenshots deleted")
    } catch {
      setShares(snapshot)
      setUsedBytes(usedSnapshot)
      toast.error("Could not delete all screenshots")
    } finally {
      setDeletingAll(false)
    }
  }

  const totalViews = React.useMemo(
    () => shares.reduce((sum, share) => sum + share.viewCount, 0),
    [shares]
  )
  const storagePercent =
    storageLimit > 0 ? Math.min(100, (usedBytes / storageLimit) * 100) : 0
  const storageNearFull = storagePercent >= 90
  const activeFilterDescription =
    dateFilter === "all"
      ? sortFilterLabel
      : `${dateFilterLabel} · ${sortFilterLabel}`
  const pageRange = buildPageRange(safePage, totalPages)

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background text-foreground">
      <section className="border-b border-border/70 bg-card/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5 sm:gap-8 sm:px-8 sm:py-6 lg:px-10">
          <nav className="flex items-center">
            <BrandLogo />
          </nav>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="min-w-0 space-y-4">
              <Breadcrumb>
                <BreadcrumbList className="label-eyebrow gap-1.5 text-muted-foreground">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="hover:text-foreground">
                      <Link href="/app">Editor</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-muted-foreground">
                      Share library
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className="max-w-4xl text-3xl leading-none font-semibold tracking-normal sm:text-6xl lg:text-7xl">
                My Shares
              </h1>
              <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Review public screenshot links, copy them again, download
                finished images, or remove anything that should no longer be
                visible.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-sm sm:gap-3 sm:p-3">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-lg bg-secondary/45 px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                    Saved
                  </p>
                  <p className="tabular mt-0.5 text-xl font-semibold sm:mt-1 sm:text-2xl">
                    {formatCount(shares.length)}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/45 px-3 py-2.5 sm:px-4 sm:py-3">
                  <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                    Views
                  </p>
                  <p className="tabular mt-0.5 text-xl font-semibold sm:mt-1 sm:text-2xl">
                    {formatCount(totalViews)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/45 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Storage
                  </p>
                  <p
                    className={cn(
                      "tabular text-xs font-medium text-muted-foreground",
                      storageNearFull && "text-destructive"
                    )}
                  >
                    {formatBytes(usedBytes)} / {formatBytes(storageLimit)}
                  </p>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/70">
                  <div
                    className={cn(
                      "h-full rounded-full bg-primary transition-[width] duration-500",
                      storageNearFull && "bg-destructive"
                    )}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {storageNearFull
                    ? "You're almost out of space — delete shares to free up room."
                    : `${Math.round(storagePercent)}% of your 1 GB share storage used`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <div className="sticky top-0 z-20 mb-4 flex flex-col gap-2.5 rounded-md border border-border/70 bg-card/80 p-2 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {filtered.length}{" "}
              {filtered.length === 1 ? "screenshot" : "screenshots"}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {activeFilterDescription}
            </p>
          </div>

          <div className="flex flex-row flex-wrap items-center gap-1.5">
            <Select
              value={dateFilter}
              onValueChange={(value) =>
                handleDateFilterChange(value as DateFilterId)
              }
            >
              <SelectTrigger
                className={cn(
                  "h-8 w-auto min-w-[112px] flex-1 justify-center gap-1 rounded-md border border-border/70 bg-background px-2.5 text-[11px] font-medium text-foreground shadow-none transition-colors hover:border-primary/50 hover:bg-secondary/20 hover:text-primary focus-visible:border-border/70 focus-visible:ring-0 data-[size=default]:h-8 sm:w-[112px] sm:flex-none",
                  dateFilterApplied &&
                    "border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                <span className="flex min-w-0 items-center gap-1">
                  <RiCalendarLine
                    className={cn(
                      "size-3 text-muted-foreground",
                      dateFilterApplied && "text-destructive"
                    )}
                  />
                  <SelectValue placeholder="All time" />
                </span>
              </SelectTrigger>
              <SelectContent
                align="end"
                position="popper"
                className="min-w-[220px] rounded-lg border-border/70 bg-popover p-1 shadow-2xl"
              >
                <SelectGroup>
                  <SelectLabel>Date range</SelectLabel>
                  {DATE_FILTERS.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={sortFilter}
              onValueChange={(value) =>
                handleSortFilterChange(value as SortFilterId)
              }
            >
              <SelectTrigger
                className={cn(
                  "h-8 w-auto min-w-[116px] flex-1 justify-center gap-1 rounded-md border border-border/70 bg-background px-2.5 text-[11px] font-medium text-foreground shadow-none transition-colors hover:border-primary/50 hover:bg-secondary/20 hover:text-primary focus-visible:border-border/70 focus-visible:ring-0 data-[size=default]:h-8 sm:w-[116px] sm:flex-none",
                  sortFilterApplied &&
                    "border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
              >
                <span className="flex min-w-0 items-center gap-1">
                  <RiSortDesc
                    className={cn(
                      "size-3 text-muted-foreground",
                      sortFilterApplied && "text-destructive"
                    )}
                  />
                  <SelectValue placeholder="Latest first" />
                </span>
              </SelectTrigger>
              <SelectContent
                align="end"
                position="popper"
                className="min-w-[190px] rounded-lg border-border/70 bg-popover p-1 shadow-2xl"
              >
                <SelectGroup>
                  <SelectLabel>Sort by</SelectLabel>
                  {SORT_FILTERS.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {shares.length > 0 && (
              <button
                type="button"
                disabled={deletingAll}
                onClick={() => setDeleteAllOpen(true)}
                className="inline-flex h-8 w-auto min-w-[96px] flex-1 items-center justify-center gap-1 rounded-md border border-destructive/30 bg-background px-2.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50 sm:w-[96px] sm:flex-none"
              >
                <RiDeleteBinLine className="size-3" />
                Delete all
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/35 px-6 py-20 text-center">
            <RiGalleryLine className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground">
              {shares.length === 0
                ? "No shared screenshots yet"
                : "No screenshots match these filters"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {shares.length === 0
                ? "Create a share link from the editor and it will appear here."
                : "Adjust the date range to see more shared screenshots."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {paginated.map((share) => (
                <article
                  key={share.id}
                  className="group overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl"
                >
                  <a
                    href={`/share/${share.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block overflow-hidden bg-secondary/30"
                  >
                    <ShimmerImage
                      src={share.imageUrl}
                      alt="Shared screenshot"
                      className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/[0.08]" />
                  </a>

                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <RiEyeLine className="size-4 shrink-0 text-muted-foreground" />
                        {formatCount(share.viewCount)}{" "}
                        {share.viewCount === 1 ? "view" : "views"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(share.createdAt)}
                        {share.sizeBytes > 0 && (
                          <> · {formatBytes(share.sizeBytes)}</>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-background p-1">
                      <button
                        type="button"
                        title="Copy link"
                        aria-label="Copy share link"
                        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        onClick={() => handleCopyLink(share.id)}
                      >
                        <RiLinkM className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Download"
                        aria-label="Download screenshot"
                        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        onClick={() => handleDownload(share.id)}
                      >
                        <RiDownloadLine className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label="Delete screenshot"
                        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                        onClick={() => setDeleteTarget(share.id)}
                      >
                        <RiDeleteBinLine className="size-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (safePage > 1) setPage(safePage - 1)
                        }}
                        className={cn(
                          safePage === 1 && "pointer-events-none opacity-50"
                        )}
                      />
                    </PaginationItem>
                    {pageRange.map((p, i) =>
                      p === "…" ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === safePage}
                            onClick={(e) => {
                              e.preventDefault()
                              setPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (safePage < totalPages) setPage(safePage + 1)
                        }}
                        className={cn(
                          safePage === totalPages &&
                            "pointer-events-none opacity-50"
                        )}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Single delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this screenshot?</AlertDialogTitle>
            <AlertDialogDescription>
              The share link will stop working and the image will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleDeleteConfirm(deleteTarget!)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete-all confirmation */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all screenshots?</AlertDialogTitle>
            <AlertDialogDescription>
              All {shares.length} shared screenshot
              {shares.length !== 1 ? "s" : ""} will be permanently removed and
              all share links will stop working. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleDeleteAll()}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
