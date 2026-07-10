import Link from "next/link"
import type { CSSProperties } from "react"

import { Nav } from "@/components/landing/nav"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

// Shared loading skeleton for the legal pages (Terms, Privacy). Keeps the real
// landing nav and breadcrumb chrome, and mirrors the hero + two-column body so
// the layout is stable while the static page streams in. `title` is known ahead
// of time, so it renders as real text rather than a placeholder bar.
export function LegalPageSkeleton({ title }: { title: string }) {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
      }
    >
      <div className={CONTENT_WIDTH}>
        <Nav />
      </div>

      {/* Hero */}
      <section className="border-b border-border/70 bg-card/30">
        <div
          className={`flex w-full flex-col gap-10 px-5 py-7 sm:px-8 lg:px-12 ${CONTENT_WIDTH}`}
        >
          <Breadcrumb>
            <BreadcrumbList className="label-eyebrow gap-1.5 text-muted-foreground">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="hover:text-foreground">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-muted-foreground">
                  {title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

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
      <section
        className={`grid w-full gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[240px_1fr] lg:px-12 lg:py-14 ${CONTENT_WIDTH}`}
      >
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
