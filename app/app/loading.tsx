import {
  EffectsSidebarSkeleton,
  InspectorSkeleton,
} from "@/components/editor/editor-skeletons"
import { Skeleton } from "@/components/ui/skeleton"

// Route-level loading UI for the editor — mirrors the chrome (top bar, left
// effects sidebar, center canvas, right inspector) so the shell stays stable
// while the client editor bundle mounts.
export default function EditorLoading() {
  return (
    <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-dashed border-border/70 bg-background px-2 sm:px-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="hidden h-4 w-28 sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </header>

      {/* Body: sidebar · canvas · inspector */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden md:flex-row">
        <EffectsSidebarSkeleton className="hidden xl:flex" />

        {/* Canvas surface — a centered mockup placeholder at 16:10. */}
        <section
          className="relative flex flex-1 items-center justify-center overflow-hidden border-b border-dashed border-border/70 bg-background dark:bg-black"
          style={{ containerType: "size" }}
        >
          <div
            className="max-h-[calc(100cqh-64px)] w-[min(1100px,calc(100cqw-48px))]"
            style={{ aspectRatio: "16 / 10" }}
          >
            <Skeleton className="h-full w-full rounded-xl ring-1 ring-border/50" />
          </div>
        </section>

        <InspectorSkeleton className="hidden xl:flex" />
      </div>
    </div>
  )
}
