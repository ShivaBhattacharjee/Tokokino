import { BrandLogo } from "@/components/editor/brand-logo"
import { Skeleton } from "@/components/ui/skeleton"

function ShareCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-background p-1">
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>
    </article>
  )
}

export default function SharesLoading() {
  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background text-foreground">
      <section className="border-b border-border/70 bg-card/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <BrandLogo />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </nav>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="min-w-0 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-64 sm:h-20 sm:w-80 lg:h-24 lg:w-96" />
              <Skeleton className="h-5 w-full max-w-2xl" />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-background/70 p-3 shadow-sm">
              <div className="rounded-lg bg-secondary/45 px-4 py-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-2 h-8 w-16" />
              </div>
              <div className="rounded-lg bg-secondary/45 px-4 py-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="mt-2 h-8 w-16" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <div className="mb-4 flex flex-col gap-2.5 rounded-md border border-border/70 bg-card/60 p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <Skeleton className="h-8 w-full rounded-md sm:w-[112px]" />
            <Skeleton className="h-8 w-full rounded-md sm:w-[116px]" />
            <Skeleton className="h-8 w-full rounded-md sm:w-[96px]" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShareCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
