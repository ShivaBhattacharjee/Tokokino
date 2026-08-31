import type { CSSProperties, ReactNode } from "react"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export function DocPage({
  eyebrow,
  title,
  summary,
  index,
  children,
}: {
  eyebrow: string
  title: string
  summary: ReactNode
  index?: ReactNode
  children: ReactNode
}) {
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
            <span className="font-mono text-[10px] tracking-widest text-primary/80 uppercase">
              {`// ${eyebrow}`}
            </span>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {title}
            </h1>
            <div className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              {summary}
            </div>
          </div>

          <div
            className={
              index
                ? "mt-8 grid gap-10 sm:mt-10 md:grid-cols-[15rem_1fr] md:gap-8 lg:grid-cols-[17rem_1fr] lg:gap-12"
                : "mt-8 sm:mt-10"
            }
          >
            {index ? <aside className="hidden md:block">{index}</aside> : null}
            <div className="min-w-0">{children}</div>
          </div>
        </section>
      </div>

      <DashedH />
      <div className={`relative ${CONTENT_WIDTH}`} style={RAIL_V_STYLE}>
        <Footer />
      </div>
      <ScrollToTop />
    </main>
  )
}
