import { RiFilmLine, RiGalleryLine, RiImageLine } from "@remixicon/react"

export type SerializedShare = {
  id: string
  imageUrl: string
  posterUrl?: string | null
  viewCount: number
  sizeBytes: number
  createdAt: string
  type?: "style" | "animate"
  contentType?: string
}

export type DateFilterId = "all" | "today" | "week" | "month" | "3months"
export type SortFilterId = "latest" | "oldest" | "mostViewed" | "leastViewed"
export type TypeFilterId = "all" | "style" | "animate"

export const TYPE_FILTERS: {
  id: TypeFilterId
  label: string
  icon: typeof RiGalleryLine
}[] = [
  { id: "all", label: "All", icon: RiGalleryLine },
  { id: "style", label: "Present", icon: RiImageLine },
  { id: "animate", label: "Animate", icon: RiFilmLine },
]

type FilterRange = { from: Date; to?: Date } | undefined

export const DATE_FILTERS: {
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

export const SORT_FILTERS: { id: SortFilterId; label: string }[] = [
  { id: "latest", label: "Latest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "mostViewed", label: "Most viewed" },
  { id: "leastViewed", label: "Least viewed" },
]

export const PAGE_SIZE = 9

export const selectTriggerClass =
  "h-9 flex-1 justify-between gap-1.5 overflow-hidden rounded-md border border-border/70 bg-background/60 px-3 text-xs font-medium text-foreground shadow-none transition-colors hover:border-primary/50 hover:text-primary focus-visible:border-border/70 focus-visible:ring-0 data-[size=default]:h-9 sm:w-[150px] sm:flex-none"

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 100 || i <= 1 ? 0 : 1)} ${units[i]}`
}

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Applies the active type + date filters and sort order to a share list. */
export function filterAndSortShares(
  shares: SerializedShare[],
  {
    typeFilter,
    dateFilter,
    sortFilter,
  }: {
    typeFilter: TypeFilterId
    dateFilter: DateFilterId
    sortFilter: SortFilterId
  }
) {
  const filterRange = DATE_FILTERS.find((p) => p.id === dateFilter)?.getRange()
  let list = shares.slice()

  if (typeFilter === "style" || typeFilter === "animate") {
    list = list.filter((s) => (s.type ?? "style") === typeFilter)
  }

  const dateFiltered = !filterRange?.from
    ? list
    : list.filter((s) => {
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
}
