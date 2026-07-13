"use client"

import * as React from "react"
import { RiArrowLeftLine, RiGalleryLine } from "@remixicon/react"
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { triggerAnchorDownload } from "@/lib/download"
import { buildPageItems } from "@/lib/pagination"
import { cn } from "@/lib/utils"

import { ShareCard } from "./share-card"
import {
  DATE_FILTERS,
  PAGE_SIZE,
  SORT_FILTERS,
  TYPE_FILTERS,
  filterAndSortShares,
  type DateFilterId,
  type SerializedShare,
  type SortFilterId,
  type TypeFilterId,
} from "./shares-data"
import { SharesToolbar } from "./shares-toolbar"
import { StatsDialog } from "./stats-dialog"

export type { SerializedShare } from "./shares-data"

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
  const [statsOpen, setStatsOpen] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [dateFilter, setDateFilter] = React.useState<DateFilterId>("all")
  const [sortFilter, setSortFilter] = React.useState<SortFilterId>("latest")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilterId>("all")

  const typeCounts = React.useMemo(() => {
    let style = 0
    let animate = 0
    for (const s of shares) {
      if ((s.type ?? "style") === "animate") animate += 1
      else style += 1
    }
    return { all: shares.length, style, animate }
  }, [shares])

  const filtered = React.useMemo(
    () => filterAndSortShares(shares, { typeFilter, dateFilter, sortFilter }),
    [shares, dateFilter, sortFilter, typeFilter]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )
  const pageRange = buildPageItems(safePage, totalPages)

  const handleDateFilterChange = (id: DateFilterId) => {
    setDateFilter(id)
    setPage(1)
  }

  const handleSortFilterChange = (id: SortFilterId) => {
    setSortFilter(id)
    setPage(1)
  }

  const handleTypeFilterChange = (id: TypeFilterId) => {
    setTypeFilter(id)
    setPage(1)
  }

  const clearFilters = () => {
    setDateFilter("all")
    setSortFilter("latest")
    setPage(1)
  }

  const dateFilterLabel =
    DATE_FILTERS.find((p) => p.id === dateFilter)?.label ?? "All time"
  const sortFilterLabel =
    SORT_FILTERS.find((p) => p.id === sortFilter)?.label ?? "Latest first"
  const typeFilterLabel =
    TYPE_FILTERS.find((p) => p.id === typeFilter)?.label ?? "All"
  const dateFilterApplied = dateFilter !== "all"
  const sortFilterApplied = sortFilter !== "latest"
  const anyFilterApplied = dateFilterApplied || sortFilterApplied

  // "Delete all" acts on the active type filter, not the whole library.
  const deleteAllTargets = React.useMemo(
    () =>
      typeFilter === "all"
        ? shares
        : shares.filter((s) => (s.type ?? "style") === typeFilter),
    [shares, typeFilter]
  )
  const deleteAllScoped = typeFilter !== "all"

  const totalViews = React.useMemo(
    () => shares.reduce((sum, share) => sum + share.viewCount, 0),
    [shares]
  )

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/share/${id}`
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied"))
  }

  const handleDownload = async (id: string) => {
    if (downloadingId) return
    setDownloadingId(id)
    const toastId = toast.loading("Preparing download…")
    try {
      const res = await fetch(`/api/share/${id}/download`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const ext = blob.type.includes("webm")
        ? "webm"
        : blob.type.includes("mp4")
          ? "mp4"
          : blob.type.includes("jpeg")
            ? "jpg"
            : "png"
      const url = URL.createObjectURL(blob)
      triggerAnchorDownload(url, `tokokino-share-${id}.${ext}`)
      URL.revokeObjectURL(url)
      toast.success("Download started", { id: toastId })
    } catch {
      toast.error("Could not download", { id: toastId })
    } finally {
      setDownloadingId(null)
    }
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
    const scope = typeFilter
    const inScope = (s: SerializedShare) =>
      scope === "all" || (s.type ?? "style") === scope
    const snapshot = shares
    const usedSnapshot = usedBytes
    const removed = shares.filter(inScope)
    if (removed.length === 0) return
    const freedBytes = removed.reduce((sum, s) => sum + s.sizeBytes, 0)
    setShares((prev) => prev.filter((s) => !inScope(s)))
    setUsedBytes((prev) => Math.max(0, prev - freedBytes))
    setDeletingAll(true)
    try {
      const query = scope === "all" ? "" : `?type=${scope}`
      const res = await fetch(`/api/share${query}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(
        scope === "all"
          ? "All screenshots deleted"
          : `All ${typeFilterLabel} screenshots deleted`
      )
    } catch {
      setShares(snapshot)
      setUsedBytes(usedSnapshot)
      toast.error("Could not delete screenshots")
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background text-foreground">
      {/* ── Top app bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:h-16 sm:px-8 lg:px-10">
          <BrandLogo
            markClassName="size-8 sm:size-9"
            wordmarkClassName="text-[17px] sm:text-lg"
          />
        </div>
      </header>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8 sm:pt-8 lg:px-10">
        <div className="min-w-0">
          <Breadcrumb>
            <BreadcrumbList className="gap-1.5 text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link href="/app">Editor</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground">
                  Share library
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
            My Shares
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Every public link you&apos;ve created. Copy, download, or retire
            anything that shouldn&apos;t be live.
          </p>
        </div>
      </div>

      {/* ── Controls + grid ─────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-7 pb-16 sm:px-8 lg:px-10">
        <SharesToolbar
          typeFilter={typeFilter}
          typeCounts={typeCounts}
          onTypeChange={handleTypeFilterChange}
          dateFilter={dateFilter}
          dateFilterApplied={dateFilterApplied}
          dateFilterLabel={dateFilterLabel}
          onDateChange={handleDateFilterChange}
          sortFilter={sortFilter}
          sortFilterApplied={sortFilterApplied}
          sortFilterLabel={sortFilterLabel}
          onSortChange={handleSortFilterChange}
          onOpenStats={() => setStatsOpen(true)}
          deleteAllCount={deleteAllTargets.length}
          deleteAllScoped={deleteAllScoped}
          deletingAll={deletingAll}
          typeFilterLabel={typeFilterLabel}
          onDeleteAll={() => setDeleteAllOpen(true)}
          filteredCount={filtered.length}
          anyFilterApplied={anyFilterApplied}
          onClearFilters={clearFilters}
        />

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="mt-4 flex min-h-[340px] flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-md border border-border/70 bg-card">
              <RiGalleryLine className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {shares.length === 0
                ? "No shared screenshots yet"
                : "Nothing matches these filters"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {shares.length === 0
                ? "Create a share link from the editor and it will show up here."
                : "Try a wider date range or a different tab."}
            </p>
            {shares.length === 0 ? (
              <Link
                href="/app"
                className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RiArrowLeftLine className="size-4" />
                Open the editor
              </Link>
            ) : (
              anyFilterApplied && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-card px-4 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Clear filters
                </button>
              )
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 grid auto-rows-min grid-cols-1 gap-4 sm:min-h-[560px] sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {paginated.map((share) => (
                <ShareCard
                  key={share.id}
                  share={share}
                  downloading={downloadingId === share.id}
                  onCopyLink={handleCopyLink}
                  onDownload={(id) => void handleDownload(id)}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex justify-end">
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        text="Prev"
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
                      p === "ellipsis" ? (
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

      <StatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        savedCount={shares.length}
        totalViews={totalViews}
        usedBytes={usedBytes}
        storageLimit={storageLimit}
      />

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
            <AlertDialogTitle>
              Delete all {deleteAllScoped ? typeFilterLabel : ""} screenshots?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All {deleteAllTargets.length}{" "}
              {deleteAllScoped ? `${typeFilterLabel} ` : ""}shared screenshot
              {deleteAllTargets.length !== 1 ? "s" : ""} will be permanently
              removed and their share links will stop working. This cannot be
              undone.
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
