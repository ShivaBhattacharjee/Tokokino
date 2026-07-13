"use client"

import * as React from "react"
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDeleteBinLine,
  RiDraftLine,
  RiFilmLine,
  RiLayoutGridLine,
  RiLoader4Line,
} from "@remixicon/react"
import { toast } from "sonner"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ShimmerImage } from "@/components/ui/shimmer-image"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { buildPageItems } from "@/lib/pagination"
import { cn } from "@/lib/utils"

export type DraftListItem = {
  id: string
  name: string
  canvasCount: number
  byteSize: number
  type?: "style" | "video" | "animate"
  updatedAt: string
  createdAt: string
  thumbnailUrl: string | null
}

type SortOrder = "latest" | "oldest"
type ProjectKind = "style" | "video" | "animate"

const PAGE_SIZE = 9

/** Fixed shell size so Present/Animate switch never shifts layout. */
const DIALOG_SHELL =
  "flex h-[min(720px,calc(100dvh-1.5rem))] w-[min(calc(100vw-1.5rem),1040px)] flex-col gap-0 overflow-hidden rounded-md bg-popover p-0 sm:max-w-[1040px]"

function formatRelativeDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return "just now"
  if (diffMs < hour) {
    const n = Math.floor(diffMs / minute)
    return `${n}m ago`
  }
  if (diffMs < day) {
    const n = Math.floor(diffMs / hour)
    return `${n}h ago`
  }
  if (diffMs < 7 * day) {
    const n = Math.floor(diffMs / day)
    return `${n}d ago`
  }
  return date.toLocaleDateString()
}

function DraftCard({
  draft,
  isCurrent,
  isOpening,
  openProgress,
  onOpen,
  onDelete,
}: {
  draft: DraftListItem
  isCurrent: boolean
  isOpening: boolean
  openProgress: { current: number; total: number } | null
  onOpen: () => void
  onDelete: () => void
}) {
  const updated = formatRelativeDate(draft.updatedAt)
  const [thumbError, setThumbError] = React.useState(false)
  const showThumbnail = draft.thumbnailUrl && !thumbError

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={isOpening}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-md border bg-secondary/30 text-left transition-colors",
          isCurrent
            ? "border-primary"
            : "border-border/50 hover:border-primary/55",
          isOpening && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/40">
          {showThumbnail ? (
            <ShimmerImage
              src={draft.thumbnailUrl!}
              alt=""
              className="size-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/40">
              <RiDraftLine className="size-7" />
              <span className="text-[10px]">No preview</span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {isCurrent ? (
              <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                Open
              </span>
            ) : null}
          </div>
          {isOpening ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 px-3 text-center text-[11px] font-medium text-foreground backdrop-blur-sm">
              <RiLoader4Line className="size-5 animate-spin text-primary" />
              <span>
                {openProgress && openProgress.total > 0
                  ? `Downloading video ${Math.min(100, Math.round((openProgress.current / openProgress.total) * 100))}%`
                  : "Downloading video…"}
              </span>
              {openProgress && openProgress.total > 0 ? (
                <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{
                      width: `${Math.min(100, Math.round((openProgress.current / openProgress.total) * 100))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground">
              {draft.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {draft.canvasCount} canvas
              {draft.canvasCount === 1 ? "" : "es"} · {updated}
            </p>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label={`Delete ${draft.name}`}
        className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground opacity-100 shadow-sm transition-opacity hover:border-destructive/40 hover:bg-destructive/15 hover:text-destructive focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <RiDeleteBinLine className="size-3.5" />
      </button>
    </div>
  )
}

function ProjectTypeRail({
  kind,
  onKindChange,
  onCreateNew,
}: {
  kind: ProjectKind
  onKindChange: (next: ProjectKind) => void
  onCreateNew: () => void
}) {
  return (
    <aside className="flex w-[188px] shrink-0 flex-col gap-3 border-r border-border/60 bg-secondary/10 p-3 sm:w-[210px]">
      <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Project type
      </p>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onKindChange("style")}
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors",
            kind === "style"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiLayoutGridLine className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Present</span>
            <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
              Static screenshot projects
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onKindChange("video")}
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors",
            kind === "video"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiFilmLine className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Videos</span>
            <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
              Video projects without a timeline
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onKindChange("animate")}
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors",
            kind === "animate"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiFilmLine className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Animate</span>
            <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
              Projects with a timeline
            </span>
          </span>
        </button>
      </div>

      <div className="mt-auto border-t border-border/50 pt-3">
        <Button
          type="button"
          className="h-9 w-full gap-1.5 border border-green-600/25 bg-green-600/15 text-[12px] text-green-700 hover:bg-green-600/25 hover:text-green-800 dark:border-green-500/30 dark:bg-green-600/20 dark:text-green-400 dark:hover:bg-green-600/30 dark:hover:text-green-300"
          onClick={onCreateNew}
        >
          <RiAddLine className="size-4" />
          New project
        </Button>
      </div>
    </aside>
  )
}

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const

/** Stable shadcn skeleton grid — fixed keys/sizes so pulse doesn't remount-flicker. */
function DraftGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading projects"
    >
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <Skeleton className="aspect-[16/10] w-full rounded-md" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  )
}

function ProjectPagination({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  // Nothing to paginate — keep the shell clean on empty states. Note we do NOT
  // hide while `loading`: during a page change `total` stays put, so the bar
  // must stay mounted (hiding it made it blink out and back on every page turn).
  // On the very first load `total` is still 0, so the bar stays hidden behind
  // the skeleton until results arrive.
  if (total <= 0) return null

  const items = buildPageItems(page, totalPages)
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-t border-border/60 px-3 sm:px-4">
      <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {total} project{total === 1 ? "" : "s"}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent className="gap-0.5">
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-[11px]"
              disabled={!canPrev || loading}
              onClick={() => onPageChange(page - 1)}
              aria-label="Go to previous page"
            >
              <RiArrowLeftSLine className="size-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          </PaginationItem>

          {items.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${index}`}>
                <PaginationEllipsis className="size-8" />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  type="button"
                  variant={item === page ? "outline" : "ghost"}
                  size="icon"
                  className="size-8 text-[11px] tabular-nums"
                  aria-label={`Go to page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  // Keep the active page interactive-looking; only lock the
                  // others while a page is loading.
                  disabled={loading && item !== page}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-[11px]"
              disabled={!canNext || loading}
              onClick={() => onPageChange(page + 1)}
              aria-label="Go to next page"
            >
              <span className="hidden sm:inline">Next</span>
              <RiArrowRightSLine className="size-3.5" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

export function OpenProjectDialog({
  open,
  onOpenChange,
  currentDraftId,
  hasUnsavedWork = false,
  defaultKind = "style",
  onOpenDraft,
  onCreateNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDraftId: string | null
  /** When true, Create new project asks before discarding the editor. */
  hasUnsavedWork?: boolean
  /** Prefer Present or Animate tab when the dialog opens. Defaults to Present. */
  defaultKind?: ProjectKind
  onOpenDraft: (
    id: string,
    onProgress?: (progress: { current: number; total: number }) => void
  ) => void | Promise<void>
  onCreateNew: () => void
}) {
  const [drafts, setDrafts] = React.useState<DraftListItem[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [openProgress, setOpenProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  )
  const [confirmNewOpen, setConfirmNewOpen] = React.useState(false)
  const [sort, setSort] = React.useState<SortOrder>("latest")
  // Always start Present unless an explicit defaultKind is provided at open.
  const [kind, setKind] = React.useState<ProjectKind>("style")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  /** True while a network request is in flight. */
  const [loading, setLoading] = React.useState(false)
  const wasOpenRef = React.useRef(false)
  const fetchGenRef = React.useRef(0)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Full skeleton only when we have nothing to show yet (open / type switch).
  // Page/sort changes keep the previous grid to avoid pulse remount flicker.
  const showSkeleton = loading && drafts === null && !error

  // Re-init only when the dialog opens (not on every parent re-render).
  /* eslint-disable react-hooks/set-state-in-effect -- reset/clear dialog UI on open/close */
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      setKind(defaultKind)
      setPage(1)
      setSort("latest")
      setDrafts(null)
      setTotal(0)
      setError(null)
      setLoading(true)
    }
    if (!open) {
      // Drop list on close so the next open always starts with a clean skeleton.
      setDrafts(null)
      setError(null)
      setLoading(false)
    }
    wasOpenRef.current = open
  }, [open, defaultKind])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- fetch drafts when dialog query changes */
  React.useEffect(() => {
    if (!open) return

    const gen = ++fetchGenRef.current
    const ac = new AbortController()
    setLoading(true)
    setError(null)

    const offset = (page - 1) * PAGE_SIZE
    void fetch(
      `/api/drafts?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&type=${kind}`,
      { credentials: "include", signal: ac.signal }
    )
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(data?.error ?? "Could not load drafts")
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- res.json() is unknown under strict DOM typings
        return res.json() as Promise<{
          drafts: DraftListItem[]
          total: number
        }>
      })
      .then((data) => {
        if (gen !== fetchGenRef.current) return
        setDrafts(data.drafts)
        setTotal(
          typeof data.total === "number" ? data.total : data.drafts.length
        )
        setLoading(false)
      })
      .catch((err) => {
        if (ac.signal.aborted || gen !== fetchGenRef.current) return
        setError(err instanceof Error ? err.message : "Could not load drafts")
        setDrafts([])
        setTotal(0)
        setLoading(false)
      })

    return () => {
      ac.abort()
    }
  }, [open, sort, kind, page])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep page in range when totals shrink (delete / filter change).
  /* eslint-disable react-hooks/set-state-in-effect -- clamp page after delete/filter */
  React.useEffect(() => {
    if (total > 0 && page > totalPages) setPage(totalPages)
  }, [page, totalPages, total])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleKindChange = (next: ProjectKind) => {
    if (next === kind) return
    // Clear list first so we show a stable skeleton instead of stale cards.
    setDrafts(null)
    setError(null)
    setTotal(0)
    setPage(1)
    setKind(next)
  }

  const handlePageChange = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    if (clamped === page) return
    // Keep current cards visible until the next page resolves (no skeleton flash).
    setPage(clamped)
  }

  const handleOpen = async (id: string) => {
    setBusyId(id)
    setOpenProgress(null)
    try {
      await onOpenDraft(id, setOpenProgress)
    } finally {
      setBusyId(null)
      setOpenProgress(null)
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistic: drop the card and decrement the count immediately, then call
    // the API. Snapshots let us restore everything if the delete fails — same
    // pattern as the shares gallery.
    const snapshotDrafts = drafts
    const snapshotTotal = total
    const remaining = snapshotDrafts?.filter((d) => d.id !== id) ?? null

    setDrafts(remaining)
    setTotal((t) => Math.max(0, t - 1))

    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Could not delete draft")
      }
      toast.success("Draft removed")
      // If the page emptied out, step back so we don't sit on a blank page.
      if (remaining && remaining.length === 0 && page > 1) {
        setPage((p) => Math.max(1, p - 1))
      }
    } catch (err) {
      console.error(err)
      // Revert the optimistic removal.
      setDrafts(snapshotDrafts)
      setTotal(snapshotTotal)
      toast.error(err instanceof Error ? err.message : "Could not delete draft")
    }
  }

  const requestCreateNew = () => {
    if (hasUnsavedWork) {
      setConfirmNewOpen(true)
      return
    }
    onCreateNew()
    onOpenChange(false)
  }

  const confirmCreateNew = () => {
    setConfirmNewOpen(false)
    onCreateNew()
    onOpenChange(false)
  }

  const draftToDelete = drafts?.find((d) => d.id === confirmDeleteId) ?? null

  return (
    <>
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{draftToDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft. This action cannot be
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
              onClick={() => {
                if (confirmDeleteId) void handleDelete(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new project?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current editor work will be discarded
              {currentDraftId ? " (unsaved changes to the open project)" : ""}.
              This cannot be undone from the cloud draft list. Save first if you
              want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer border-green-600/20 bg-green-600/10 text-green-600 hover:bg-green-600/20 dark:bg-green-600/20 dark:hover:bg-green-600/30"
              onClick={confirmCreateNew}
            >
              Discard &amp; create new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={DIALOG_SHELL}>
          <div className="shrink-0 border-b border-border/60 bg-popover px-5 py-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <DialogTitle className="text-[15px]">Open project</DialogTitle>
                <DialogDescription className="mt-0.5 text-[12px]">
                  Pick a saved draft to resume editing, or start fresh.
                </DialogDescription>
              </div>
              <Select
                value={sort}
                onValueChange={(val) => {
                  setSort(val as SortOrder)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-full self-stretch rounded-md border border-border/70 bg-background px-2.5 text-[11px] font-medium text-foreground shadow-none transition-colors hover:border-primary/50 hover:bg-secondary/20 focus-visible:border-border/70 focus-visible:ring-0 sm:mr-6 sm:w-[110px] sm:self-auto">
                  <SelectValue placeholder="Latest" />
                </SelectTrigger>
                <SelectContent
                  align="end"
                  position="popper"
                  className="min-w-[110px] rounded-md border border-border/70 bg-popover p-1 shadow-2xl"
                >
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Left rail — project type */}
            <ProjectTypeRail
              kind={kind}
              onKindChange={handleKindChange}
              onCreateNew={requestCreateNew}
            />

            {/* Main list + pagination */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {/* Fixed min height so Present/Animate never shifts the shell. */}
                <div className="min-h-[480px]">
                  {showSkeleton ? <DraftGridSkeleton /> : null}

                  {!showSkeleton && error ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-[12px] text-destructive">
                      {error}
                    </div>
                  ) : null}

                  {!showSkeleton && !error && drafts && drafts.length === 0 ? (
                    <div className="flex min-h-[440px] flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                      <span className="inline-flex size-10 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground">
                        {kind === "animate" ? (
                          <RiFilmLine className="size-5" />
                        ) : kind === "video" ? (
                          <RiFilmLine className="size-5" />
                        ) : (
                          <RiDraftLine className="size-5" />
                        )}
                      </span>
                      <p className="text-[13px] font-medium text-foreground">
                        {kind === "animate"
                          ? "No animate projects yet"
                          : kind === "video"
                            ? "No video projects yet"
                            : "No present projects yet"}
                      </p>
                      <p className="max-w-[280px] text-[12px] text-muted-foreground">
                        {kind === "animate"
                          ? "Save while Animate is on (Save → Save as animate draft) to see projects here."
                          : kind === "video"
                            ? "Save a video canvas with Save → Save as draft to see projects here."
                            : "Use Save → Save as draft from the present editor to keep projects here."}
                      </p>
                    </div>
                  ) : null}

                  {!showSkeleton && !error && drafts && drafts.length > 0 ? (
                    <div
                      className={cn(
                        "grid grid-cols-2 gap-3 sm:grid-cols-3",
                        loading && "pointer-events-none opacity-70"
                      )}
                    >
                      {drafts.map((draft) => (
                        <DraftCard
                          key={draft.id}
                          draft={draft}
                          isCurrent={currentDraftId === draft.id}
                          isOpening={busyId === draft.id}
                          openProgress={
                            busyId === draft.id ? openProgress : null
                          }
                          onOpen={() => void handleOpen(draft.id)}
                          onDelete={() => setConfirmDeleteId(draft.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <ProjectPagination
                page={page}
                totalPages={totalPages}
                total={total}
                loading={loading}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
