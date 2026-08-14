import type { CSSProperties } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { Skeleton } from "@/components/ui/skeleton"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

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
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Nav />
      </div>
      <DashedH />

      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <section className="relative px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-20" />
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {title}
            </h1>
            <div className="mt-1 max-w-xl space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>

          <div className="mt-8 grid gap-10 sm:mt-10 md:grid-cols-[13rem_1fr] md:gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
            <aside className="hidden md:block">
              <div className="sticky top-8 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-px w-24" />
                ))}
              </div>
            </aside>

            <div className="min-w-0 space-y-10">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-4 border-t border-border/50 pt-10"
                >
                  <Skeleton className="h-5 w-1/2" />
                  <div className="space-y-2.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-5/6" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
