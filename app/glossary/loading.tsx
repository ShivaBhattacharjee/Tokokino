import type { CSSProperties } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Nav } from "@/components/landing/nav"
import {
  RAIL_H_RIGHT_STYLE,
  RAIL_V_STYLE,
} from "@/components/landing/rail-styles"
import { Skeleton } from "@/components/ui/skeleton"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export default function GlossaryLoading() {
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
        <section className="relative px-5 pb-14 sm:px-8 lg:px-12">
          <div className="flex flex-col gap-1.5 py-10 sm:py-14">
            <Skeleton className="h-2.5 w-20" />
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
              Glossary
            </h1>
            <div className="mt-1 max-w-xl space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>

          <div
            style={RAIL_V_STYLE}
            className="relative -mx-5 flex flex-wrap gap-x-0.5 gap-y-1 px-5 py-2.5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
          >
            {Array.from({ length: 26 }).map((_, i) => (
              <Skeleton key={i} className="size-7 rounded-[3px]" />
            ))}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px"
              style={RAIL_H_RIGHT_STYLE}
            />
          </div>

          <div className="mt-10 space-y-14 sm:mt-14">
            {Array.from({ length: 4 }).map((_, group) => (
              <div key={group}>
                <div className="flex items-center gap-4">
                  <Skeleton className="size-8 rounded-[3px]" />
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-accent-foreground/30"
                  />
                  <Skeleton className="h-2.5 w-14" />
                </div>
                <div className="mt-8 space-y-8">
                  {Array.from({ length: 3 }).map((_, entry) => (
                    <div key={entry} className="space-y-2.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3.5 w-full max-w-2xl" />
                      <Skeleton className="h-3.5 w-4/5 max-w-2xl" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
