import type { CSSProperties } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { Skeleton } from "@/components/ui/skeleton"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export default function ChangelogLoading() {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as CSSProperties
      }
    >
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="relative px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-48 sm:h-9" />
            <Skeleton className="mt-1 h-16 max-w-xl" />
          </div>

          <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[13rem_1fr] lg:gap-12">
            <aside className="hidden space-y-3 lg:block">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-28" />
              ))}
            </aside>
            <div className="space-y-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-3 border-t border-border/50 pt-8"
                >
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-14 max-w-2xl" />
                  <Skeleton className="h-4 max-w-xl" />
                  <Skeleton className="h-4 max-w-lg" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
