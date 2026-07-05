import { Skeleton } from "@/components/ui/skeleton"

// Route-level loading UI for /share/[id] — mirrors ShareView's header + framed
// image so the layout doesn't shift when the share metadata resolves.
export default function ShareLoading() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-dashed border-border/70 pb-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-44 rounded-lg" />
            <Skeleton className="h-10 w-44 rounded-lg" />
          </div>
        </header>

        <section className="grid min-h-0 flex-1 place-items-center py-6">
          <div className="bg-checker w-full overflow-hidden rounded-lg border border-border/70">
            <Skeleton className="block h-[52vh] max-h-[calc(100svh-9rem)] w-full rounded-none" />
          </div>
        </section>
      </div>
    </main>
  )
}
