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
  RiMore2Fill,
  RiCloseLine,
  RiPencilLine,
  RiSearchLine,
} from "@remixicon/react"
import debounce from "lodash/debounce"
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DRAFT_NAME_MAX_LENGTH } from "@/lib/schemas/draft"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShimmerBox, ShimmerImage } from "@/components/ui/shimmer-image"
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
/** Which kinds a name search narrows to. "all" spans every project type. */
type SearchScope = ProjectKind | "all"

const PAGE_SIZE = 9
/** Long enough to skip most intermediate keystrokes, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300
/**
 * Fuzzy matching needs a real prefix — the server ignores 1-character matches,
 * so searching on one would render an empty state instead of the full list.
 */
const MIN_SEARCH_LENGTH = 2

/**
 * Search scopes, in rail order. The `style` kind is surfaced as "Screenshots"
 * everywhere in this dialog — its old "Present" label collided with the app's
 * preset system (`present-presets.ts`) and read as "presets" rather than "static
 * screenshot project". The stored type is still `style`.
 */
const SEARCH_SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "style", label: "Screenshots" },
  { value: "video", label: "Videos" },
  { value: "animate", label: "Animate" },
]

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
  busy,
  onOpen,
  onDelete,
  onRename,
}: {
  draft: DraftListItem
  isCurrent: boolean
  /** This card is the one being opened — shows the spinner overlay. */
  isOpening: boolean
  /** Any card is being opened — every card is locked out until it settles. */
  busy: boolean
  onOpen: () => void
  onDelete: () => void
  onRename: () => void
}) {
  const updated = formatRelativeDate(draft.updatedAt)
  const [thumbError, setThumbError] = React.useState(false)
  const showThumbnail = draft.thumbnailUrl && !thumbError

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-md border bg-secondary/30 text-left transition-colors",
          isCurrent
            ? "border-primary"
            : "border-border/50 hover:border-primary/55",
          busy && "cursor-not-allowed",
          busy && !isOpening && "opacity-50",
          isOpening && "opacity-60"
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
              <span>Opening…</span>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            disabled={busy}
            aria-label={`Project options for ${draft.name}`}
            className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-sm transition-colors hover:border-primary/45 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40 data-[state=open]:border-primary/45 data-[state=open]:text-foreground"
          >
            <RiMore2Fill className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onSelect={onRename}
            className="cursor-pointer gap-2"
          >
            <RiPencilLine className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={onDelete}
            className="cursor-pointer gap-2"
          >
            <RiDeleteBinLine className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ProjectTypeRail({
  kind,
  onKindChange,
  onCreateNew,
  searching = false,
}: {
  kind: ProjectKind
  onKindChange: (next: ProjectKind) => void
  onCreateNew: () => void
  /** A search is active, so the in-field scope owns the filter, not this rail. */
  searching?: boolean
}) {
  return (
    <aside className="flex shrink-0 flex-col gap-2 border-b border-border/60 bg-secondary/10 p-3 sm:w-[188px] sm:gap-3 sm:border-r sm:border-b-0 md:w-[210px]">
      <p className="hidden px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:block">
        Project type
      </p>
      {searching ? (
        <p className="-mt-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
          Searching — narrow with the filter in the search box.
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-row gap-1.5 overflow-x-auto transition-opacity sm:flex-col sm:overflow-visible",
          searching && "pointer-events-none opacity-40"
        )}
        aria-hidden={searching}
      >
        <button
          type="button"
          onClick={() => onKindChange("style")}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors sm:w-full sm:gap-2.5 sm:py-2.5",
            kind === "style"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiLayoutGridLine className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Screenshots</span>
            <span className="mt-0.5 hidden text-[10px] leading-snug opacity-80 sm:block">
              Static image projects
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onKindChange("video")}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors sm:w-full sm:gap-2.5 sm:py-2.5",
            kind === "video"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiFilmLine className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Videos</span>
            <span className="mt-0.5 hidden text-[10px] leading-snug opacity-80 sm:block">
              Projects without a timeline
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onKindChange("animate")}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors sm:w-full sm:gap-2.5 sm:py-2.5",
            kind === "animate"
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border/50 bg-background/40 text-muted-foreground hover:border-border hover:bg-secondary/30 hover:text-foreground"
          )}
        >
          <RiFilmLine className="size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12px] font-medium">Animate</span>
            <span className="mt-0.5 hidden text-[10px] leading-snug opacity-80 sm:block">
              Projects with a timeline
            </span>
          </span>
        </button>
      </div>

      <div className="border-t border-border/50 pt-3 sm:mt-auto">
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

/** Animated shimmer grid while drafts load — matches thumbnail card proportions. */
function DraftGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading projects"
    >
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <ShimmerBox className="aspect-[16/10] w-full rounded-md" />
          <ShimmerBox className="h-3 w-28 rounded-sm" />
          <ShimmerBox className="h-2.5 w-20 rounded-sm" />
        </div>
      ))}
    </div>
  )
}

function ProjectPagination({
  searching = false,
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: {
  searching?: boolean
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
    <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 px-3 py-1.5 sm:flex-nowrap sm:px-4 sm:py-0">
      <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
        {total} {searching ? "result" : "project"}
        {total === 1 ? "" : "s"}
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

function RenameDraftDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (name: string) => void
}) {
  const [name, setName] = React.useState(currentName)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(currentName)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [open, currentName])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== currentName

  /** Commit the trimmed name when it differs from the current one. */
  const submit = () => {
    if (!canSubmit) return
    onRename(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Give this project a new name.</DialogDescription>
        </DialogHeader>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          maxLength={DRAFT_NAME_MAX_LENGTH}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
        />
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="lg" onClick={submit} disabled={!canSubmit}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  /** Preferred tab when the dialog opens. Defaults to Screenshots. */
  defaultKind?: ProjectKind
  onOpenDraft: (id: string) => void | Promise<void>
  onCreateNew: () => void
}) {
  const [drafts, setDrafts] = React.useState<DraftListItem[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const openingRef = React.useRef(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  )
  const [renameId, setRenameId] = React.useState<string | null>(null)
  const [confirmNewOpen, setConfirmNewOpen] = React.useState(false)
  const [sort, setSort] = React.useState<SortOrder>("latest")
  // Always start Present unless an explicit defaultKind is provided at open.
  const [kind, setKind] = React.useState<ProjectKind>("style")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  /** What the user is typing (drives the input). */
  const [query, setQuery] = React.useState("")
  /** The debounced value the request actually uses. */
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  const [searchScope, setSearchScope] = React.useState<SearchScope>("all")
  /** True while a network request is in flight. */
  const [loading, setLoading] = React.useState(false)
  const wasOpenRef = React.useRef(false)
  const fetchGenRef = React.useRef(0)
  const renameOpsRef = React.useRef<Map<string, number>>(new Map())

  const searching = debouncedQuery.length > 0
  // A search spans project kinds — the scope dropdown decides which, NOT the
  // left rail. Without a query the rail's kind drives the list as before.
  const effectiveKind: ProjectKind | null = searching
    ? searchScope === "all"
      ? null
      : searchScope
    : kind

  // One debounced setter for the whole dialog lifetime, cancelled on unmount so
  // a pending keystroke can't set state after the dialog closes.
  const pushQuery = React.useMemo(
    () =>
      debounce((value: string) => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS),
    []
  )
  React.useEffect(() => () => pushQuery.cancel(), [pushQuery])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(1)
    // Clearing (or dropping under the minimum) is instant — waiting to see the
    // whole list again feels broken.
    if (value.trim().length < MIN_SEARCH_LENGTH) {
      pushQuery.cancel()
      setDebouncedQuery("")
      return
    }
    pushQuery(value)
  }

  const clearQuery = () => {
    pushQuery.cancel()
    setQuery("")
    setDebouncedQuery("")
    setPage(1)
  }

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
      setQuery("")
      setDebouncedQuery("")
      setSearchScope("all")
      setDrafts(null)
      setTotal(0)
      setError(null)
      setLoading(true)
    }
    if (!open) {
      // Drop list on close so the next open always starts with a clean skeleton.
      pushQuery.cancel()
      setQuery("")
      setDebouncedQuery("")
      setDrafts(null)
      setError(null)
      setLoading(false)
    }
    wasOpenRef.current = open
  }, [open, defaultKind, pushQuery])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- fetch drafts when dialog query changes */
  React.useEffect(() => {
    if (!open) return

    const gen = ++fetchGenRef.current
    const ac = new AbortController()
    setLoading(true)
    setError(null)

    const offset = (page - 1) * PAGE_SIZE
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      sort,
    })
    // Omit `type` entirely when searching every kind — the API treats a missing
    // type as "all", and sending an empty one would 400.
    if (effectiveKind) params.set("type", effectiveKind)
    if (debouncedQuery) params.set("q", debouncedQuery)
    void fetch(`/api/drafts?${params.toString()}`, {
      credentials: "include",
      signal: ac.signal,
    })
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
  }, [open, sort, effectiveKind, debouncedQuery, page])
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
    // Synchronous guard: setBusyId is async, so a rapid second click (same or
    // another card) would otherwise start a concurrent open before the state
    // update lands. The ref rejects re-entry the instant the first call begins.
    if (openingRef.current) return
    openingRef.current = true
    setBusyId(id)
    try {
      await onOpenDraft(id)
    } finally {
      openingRef.current = false
      setBusyId(null)
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

  /** Optimistically rename a draft, rolling back only if this op is still latest. */
  const handleRename = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const target = drafts?.find((d) => d.id === id)
    if (!target || target.name === trimmed) return
    const previousName = target.name
    const opId = (renameOpsRef.current.get(id) ?? 0) + 1
    renameOpsRef.current.set(id, opId)

    setDrafts(
      (prev) =>
        prev?.map((d) => (d.id === id ? { ...d, name: trimmed } : d)) ?? prev
    )

    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Could not rename draft")
      }
      toast.success("Project renamed")
    } catch (err) {
      console.error(err)
      // Only roll back this draft's name, and only if a newer rename hasn't
      // superseded this request — so a stale failure can't rewind later state.
      if (renameOpsRef.current.get(id) === opId) {
        setDrafts(
          (prev) =>
            prev?.map((d) =>
              d.id === id ? { ...d, name: previousName } : d
            ) ?? prev
        )
        toast.error(
          err instanceof Error ? err.message : "Could not rename draft"
        )
      }
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
  const draftToRename = drafts?.find((d) => d.id === renameId) ?? null

  return (
    <>
      <RenameDraftDialog
        open={renameId !== null}
        onOpenChange={(next) => {
          if (!next) setRenameId(null)
        }}
        currentName={draftToRename?.name ?? ""}
        onRename={(name) => {
          if (renameId) void handleRename(renameId, name)
          setRenameId(null)
        }}
      />
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
        <DialogContent className={DIALOG_SHELL} showCloseButton={false}>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-3.5 right-4 z-10 inline-flex size-7 items-center justify-center rounded-md border border-border/60 bg-secondary/60 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              <RiCloseLine className="size-4" />
            </button>
          </DialogClose>
          <div className="shrink-0 border-b border-border/60 bg-popover px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="pr-9 sm:pr-0">
                <DialogTitle className="text-[15px]">Open project</DialogTitle>
                <DialogDescription className="mt-0.5 text-[12px]">
                  Pick a saved draft to resume editing, or start fresh.
                </DialogDescription>
              </div>
              <div className="flex w-full items-center gap-2 sm:mr-14 sm:w-auto">
                <div className="flex h-7 min-w-0 flex-1 items-center rounded-md border border-border/70 bg-background transition-colors focus-within:border-primary/50 hover:border-primary/50 sm:w-[290px] sm:flex-none">
                  <RiSearchLine className="pointer-events-none ml-2.5 size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && query) {
                        // Clear the field before the dialog's own Esc closes it.
                        e.stopPropagation()
                        clearQuery()
                      }
                    }}
                    placeholder="Search projects"
                    aria-label="Search projects by name"
                    maxLength={DRAFT_NAME_MAX_LENGTH}
                    className="h-full min-w-0 flex-1 bg-transparent px-2 text-[11px] font-medium text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={clearQuery}
                      aria-label="Clear search"
                      className="mr-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:outline-none"
                    >
                      <RiCloseLine className="size-3.5" />
                    </button>
                  ) : null}

                  {/* Scope lives inside the field and is always mounted: it
                      describes what a search WILL cover, so hiding it until
                      results exist would surface it only once it's too late to
                      be useful. */}
                  <Select
                    value={searchScope}
                    onValueChange={(val) => {
                      setSearchScope(val as SearchScope)
                      setPage(1)
                    }}
                  >
                    {/* The base trigger paints its own surface (`bg-input/20`
                        plus a `dark:bg-input/30` that survives tailwind-merge),
                        which reads as a nested box inside the search field.
                        Both themes are zeroed so this is plain inline text. */}
                    <SelectTrigger
                      aria-label="Limit search to a project type"
                      className="h-6 w-auto shrink-0 gap-1 rounded-none border-0 bg-transparent px-2 text-[11px] font-medium text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent [&>svg]:size-3"
                    >
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      position="popper"
                      className="min-w-[104px] rounded-md border border-border/70 bg-popover p-1 shadow-2xl"
                    >
                      {SEARCH_SCOPES.map((scope) => (
                        <SelectItem key={scope.value} value={scope.value}>
                          {scope.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select
                  value={sort}
                  onValueChange={(val) => {
                    setSort(val as SortOrder)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[104px] shrink-0 rounded-md border border-border/70 bg-background px-2.5 text-[11px] font-medium text-foreground shadow-none transition-colors hover:border-primary/50 hover:bg-secondary/20 focus-visible:border-border/70 focus-visible:ring-0">
                    <SelectValue placeholder="Latest" />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    position="popper"
                    className="min-w-[104px] rounded-md border border-border/70 bg-popover p-1 shadow-2xl"
                  >
                    <SelectItem value="latest">Latest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* Left rail — project type */}
            <ProjectTypeRail
              kind={kind}
              onKindChange={handleKindChange}
              onCreateNew={requestCreateNew}
              searching={searching}
            />

            {/* Main list + pagination */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {/* Fixed min height so Present/Animate never shifts the shell. */}
                <div className="sm:min-h-[480px]">
                  {showSkeleton ? <DraftGridSkeleton /> : null}

                  {!showSkeleton && error ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-[12px] text-destructive">
                      {error}
                    </div>
                  ) : null}

                  {!showSkeleton && !error && drafts && drafts.length === 0 ? (
                    <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:min-h-[440px]">
                      <span className="inline-flex size-10 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground">
                        {searching ? (
                          <RiSearchLine className="size-5" />
                        ) : kind === "animate" || kind === "video" ? (
                          <RiFilmLine className="size-5" />
                        ) : (
                          <RiDraftLine className="size-5" />
                        )}
                      </span>
                      {/* An empty search is a different problem from an empty
                          project type — don't tell the user to go save a draft. */}
                      <p className="text-[13px] font-medium text-foreground">
                        {searching
                          ? "No projects found"
                          : kind === "animate"
                            ? "No animate projects yet"
                            : kind === "video"
                              ? "No video projects yet"
                              : "No screenshot projects yet"}
                      </p>
                      <p className="max-w-[280px] text-[12px] text-muted-foreground">
                        {searching ? (
                          <>
                            Nothing matches &ldquo;{debouncedQuery}&rdquo;
                            {searchScope === "all"
                              ? ""
                              : ` in ${SEARCH_SCOPES.find((s) => s.value === searchScope)?.label.toLowerCase()} projects`}
                            .
                          </>
                        ) : kind === "animate" ? (
                          "Save while Animate is on (Save → Save as animate draft) to see projects here."
                        ) : kind === "video" ? (
                          "Save a video canvas with Save → Save as draft to see projects here."
                        ) : (
                          "Use Save → Save as draft from the editor to keep projects here."
                        )}
                      </p>
                      {searching ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 text-[11px]"
                          onClick={clearQuery}
                        >
                          Clear search
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {!showSkeleton && !error && drafts && drafts.length > 0 ? (
                    <div
                      className={cn(
                        "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3",
                        loading && "pointer-events-none opacity-70"
                      )}
                    >
                      {drafts.map((draft) => (
                        <DraftCard
                          key={draft.id}
                          draft={draft}
                          isCurrent={currentDraftId === draft.id}
                          isOpening={busyId === draft.id}
                          busy={busyId !== null}
                          onOpen={() => void handleOpen(draft.id)}
                          onDelete={() => setConfirmDeleteId(draft.id)}
                          onRename={() => setRenameId(draft.id)}
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
                searching={searching}
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
