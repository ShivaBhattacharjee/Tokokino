"use client"

import { CornerMarkers } from "@/components/editor/corner-marker"
import { Skeleton } from "@/components/ui/skeleton"
import { BASE_CANVAS_WIDTH } from "@/components/editor/canvas/constants"
import { useEditorStore } from "@/lib/editor/store"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Effects Sidebar Skeleton — matches EffectsSidebar layout (left panel)      */
/* -------------------------------------------------------------------------- */

export function EffectsSidebarSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[268px] shrink-0 flex-col overflow-hidden border-r border-dashed border-border/70 bg-sidebar",
        className
      )}
    >
      {/* Header with project name */}
      <div className="shrink-0 px-4 pt-5 pb-4">
        <div className="mb-4 flex items-center gap-1.5">
          <Skeleton className="h-3 w-8" />
          <span className="text-muted-foreground/45">/</span>
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-4">
          {/* Aspect Ratio */}
          <div>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          {/* Frame */}
          <div>
            <Skeleton className="mb-2 h-4 w-14" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Presets area */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2 md:block md:space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[16/10] w-full rounded-[8px]" />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-2/3 rounded-md" />
                  <Skeleton className="size-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Account tile skeleton */}
      <div className="shrink-0 border-t border-dashed border-border/70 px-4 py-2.5">
        <div className="flex h-12 w-full items-center gap-2.5 px-1.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <Skeleton className="size-4 shrink-0" />
        </div>
      </div>
    </aside>
  )
}

/* -------------------------------------------------------------------------- */
/*  Canvas Skeleton — matches Canvas layout (center area)                      */
/* -------------------------------------------------------------------------- */

export function CanvasSkeleton() {
  const aspect = useEditorStore((s) => s.present.aspect)
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode)

  const aw = aspect.w || 16
  const ah = aspect.h || 10
  const widthPx = BASE_CANVAS_WIDTH

  return (
    <section
      data-editor-canvas-surface
      className={cn(
        "relative z-0 flex flex-1 touch-none overflow-hidden overscroll-none bg-background transition-all duration-300 dark:bg-black",
        isPreviewMode
          ? "items-center justify-center p-0"
          : "border-b border-dashed border-border/70"
      )}
      style={{
        containerType: "size",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      role="presentation"
    >
      <CornerMarkers className="text-border" size={12} />
      <div
        className={cn(
          "absolute left-1/2 origin-center -translate-x-1/2 -translate-y-1/2",
          isPreviewMode ? "top-1/2" : "top-[23%] md:top-1/2"
        )}
        style={{
          width: `min(${widthPx}px, calc(100cqw - 32px))`,
        }}
      >
        <Skeleton
          className="w-full rounded-xl opacity-30 ring-1 ring-border/40"
          style={{
            aspectRatio: `${aw} / ${ah}`,
          }}
        />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Inspector Skeleton — matches Inspector layout (right panel)                */
/* -------------------------------------------------------------------------- */

export function InspectorSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[260px] shrink-0 flex-col overflow-hidden border-l border-dashed border-border/70 bg-sidebar xl:w-[308px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3 xl:px-4">
        <Skeleton className="h-4 w-12" />
      </div>

      {/* Sections */}
      <div className="min-h-0 flex-1 px-3 py-3 xl:px-4">
        {/* Background section */}
        <InspectorSectionSkeleton />
        <div className="my-3 h-px bg-border/50" />

        {/* Backdrop section */}
        <InspectorSectionSkeleton />
        <div className="my-3 h-px bg-border/50" />

        {/* Border section */}
        <InspectorSectionSkeleton />
        <div className="my-3 h-px bg-border/50" />

        {/* Padding section */}
        <InspectorSectionSkeleton />
        <div className="my-3 h-px bg-border/50" />

        {/* Tilt & Scale section */}
        <InspectorSectionSkeleton />
        <div className="my-3 h-px bg-border/50" />

        {/* Shadow section */}
        <InspectorSectionSkeleton />
      </div>
    </aside>
  )
}

function InspectorSectionSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="space-y-2.5 pt-2">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-6 w-3/4 rounded-md" />
      </div>
    </div>
  )
}
