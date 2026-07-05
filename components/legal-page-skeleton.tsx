import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BrandLogo } from "@/components/editor/brand-logo"
import { Skeleton } from "@/components/ui/skeleton"

// Shared loading skeleton for the legal pages (Terms, Privacy). Keeps the real
// nav chrome (logo + back link) and mirrors the hero + two-column body so the
// layout is stable while the static page streams in. `title` is known ahead of
// time, so it renders as real text rather than a placeholder bar.
export function LegalPageSkeleton({ title }: { title: string }) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      {/* Hero */}
      <section className="border-b border-border/70 bg-card/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-7 sm:px-10 lg:px-12">
          <nav className="flex items-center justify-between gap-5">
            <BrandLogo />
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to sign in
            </Link>
          </nav>

          <div className="min-w-0 space-y-4 text-left">
            <h1 className="max-w-full text-[clamp(1.75rem,5.2vw,5.05rem)] leading-[0.95] font-semibold tracking-[-0.04em] whitespace-nowrap">
              {title}
            </h1>
            <div className="max-w-2xl space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </section>

      {/* Body: sticky index + article */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[240px_1fr] lg:px-12 lg:py-14">
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-5">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </aside>

        <article className="min-w-0 space-y-9">
          {/* Intro callout */}
          <div className="space-y-2 border-l-2 border-primary/60 pl-5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>

          {/* Section blocks */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-4 border-t border-border/70 pt-8">
              <Skeleton className="h-5 w-1/2" />
              <div className="space-y-2.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </article>
      </section>
    </main>
  )
}
