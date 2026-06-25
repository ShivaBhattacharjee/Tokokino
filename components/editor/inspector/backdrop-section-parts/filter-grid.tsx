"use client"

import type { AssetFilter } from "@/lib/editor/state-types"
import { assetFilterCss } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

import { BACKDROP_FILTERS, type BackdropPickerLayout } from "./constants"

export function BackdropFilterGrid({
  current,
  onChange,
  layout = "grid",
  columns = 3,
}: {
  current: AssetFilter
  onChange: (f: AssetFilter) => void
  layout?: BackdropPickerLayout
  columns?: 3 | 4
}) {
  return (
    <div
      className={cn(
        layout === "carousel"
          ? "flex [scrollbar-width:none] gap-2 overflow-x-auto overflow-y-hidden px-1 py-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : columns === 4
            ? "grid grid-cols-4 gap-2 px-1 py-1"
            : "grid grid-cols-3 gap-2 px-1 py-1"
      )}
    >
      {BACKDROP_FILTERS.map((f) => {
        const active = current === f.id
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-1 transition-all",
              layout === "carousel" && "w-20 shrink-0",
              active
                ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                : "border-border/60 bg-secondary/20 hover:border-foreground/30"
            )}
          >
            <div
              className="aspect-square w-full rounded-sm"
              style={{
                background: "linear-gradient(135deg,#6366f1,#ec4899,#f59e0b)",
                filter: assetFilterCss(f.id),
              }}
            />
            <span
              className={cn(
                "text-[9px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {f.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
