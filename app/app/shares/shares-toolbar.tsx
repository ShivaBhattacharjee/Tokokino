"use client"

import {
  RiBarChartBoxLine,
  RiCalendarLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiSortDesc,
} from "@remixicon/react"
import { motion } from "motion/react"

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

import {
  DATE_FILTERS,
  SORT_FILTERS,
  TYPE_FILTERS,
  selectTriggerClass,
  type DateFilterId,
  type SortFilterId,
  type TypeFilterId,
} from "./shares-data"

export function SharesToolbar({
  typeFilter,
  typeCounts,
  onTypeChange,
  dateFilter,
  dateFilterApplied,
  dateFilterLabel,
  onDateChange,
  sortFilter,
  sortFilterApplied,
  sortFilterLabel,
  onSortChange,
  onOpenStats,
  deleteAllCount,
  deleteAllScoped,
  deletingAll,
  typeFilterLabel,
  onDeleteAll,
  filteredCount,
  anyFilterApplied,
  onClearFilters,
}: {
  typeFilter: TypeFilterId
  typeCounts: Record<TypeFilterId, number>
  onTypeChange: (id: TypeFilterId) => void
  dateFilter: DateFilterId
  dateFilterApplied: boolean
  dateFilterLabel: string
  onDateChange: (id: DateFilterId) => void
  sortFilter: SortFilterId
  sortFilterApplied: boolean
  sortFilterLabel: string
  onSortChange: (id: SortFilterId) => void
  onOpenStats: () => void
  deleteAllCount: number
  deleteAllScoped: boolean
  deletingAll: boolean
  typeFilterLabel: string
  onDeleteAll: () => void
  filteredCount: number
  anyFilterApplied: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="border-t border-border/60 pt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Segmented tabs */}
        <div className="-mx-4 flex [scrollbar-width:none] justify-center overflow-x-auto px-4 sm:mx-0 sm:justify-start sm:overflow-visible sm:px-0">
          <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card/50 p-1">
            {TYPE_FILTERS.map((tab) => {
              const active = typeFilter === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTypeChange(tab.id)}
                  className={cn(
                    "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="shareTabActive"
                      className="absolute inset-0 rounded-md bg-primary shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {tab.label}
                    <span
                      className={cn(
                        "tabular rounded-md px-1.5 py-0.5 text-[10px] leading-none",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-border/50 text-muted-foreground"
                      )}
                    >
                      {typeCounts[tab.id]}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={dateFilter}
            onValueChange={(value) => onDateChange(value as DateFilterId)}
          >
            <SelectTrigger
              className={cn(
                selectTriggerClass,
                dateFilterApplied &&
                  "border-primary/50 text-primary hover:border-primary"
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <RiCalendarLine className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">
                  <SelectValue placeholder="All time" />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent
              align="end"
              position="popper"
              className="min-w-[200px] rounded-md border-border/70 bg-popover p-1 shadow-2xl"
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
            onValueChange={(value) => onSortChange(value as SortFilterId)}
          >
            <SelectTrigger
              className={cn(
                selectTriggerClass,
                sortFilterApplied &&
                  "border-primary/50 text-primary hover:border-primary"
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <RiSortDesc className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">
                  <SelectValue placeholder="Latest first" />
                </span>
              </span>
            </SelectTrigger>
            <SelectContent
              align="end"
              position="popper"
              className="min-w-[190px] rounded-md border-border/70 bg-popover p-1 shadow-2xl"
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

          <button
            type="button"
            onClick={onOpenStats}
            aria-label="Library stats"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-accent-foreground/30 bg-accent-foreground/10 px-3 text-xs font-medium text-accent-foreground transition-colors hover:border-accent-foreground/50 hover:bg-accent-foreground/20"
          >
            <RiBarChartBoxLine className="size-4" />
            <span className="hidden sm:inline">View stats</span>
          </button>

          {deleteAllCount > 0 && (
            <button
              type="button"
              disabled={deletingAll}
              onClick={onDeleteAll}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:border-destructive/60 hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50"
            >
              <RiDeleteBinLine className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {deleteAllScoped ? `Delete ${typeFilterLabel}` : "Delete all"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Result summary + active filter chips */}
      {filteredCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span className="tabular font-medium text-foreground">
            {filteredCount} {filteredCount === 1 ? "result" : "results"}
          </span>
          {anyFilterApplied && (
            <>
              <span className="text-border">·</span>
              {dateFilterApplied && (
                <FilterChip
                  label={dateFilterLabel}
                  onClear={() => onDateChange("all")}
                />
              )}
              {sortFilterApplied && (
                <FilterChip
                  label={sortFilterLabel}
                  onClear={() => onSortChange("latest")}
                />
              )}
              <button
                type="button"
                onClick={onClearFilters}
                className="font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 py-0.5 pr-1 pl-2.5 text-xs font-medium text-foreground">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RiCloseLine className="size-3" />
      </button>
    </span>
  )
}
