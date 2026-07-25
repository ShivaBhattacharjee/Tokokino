import type { Metadata } from "next"
import Link from "next/link"

import { DashedH } from "@/components/landing/dashed-h"
import { Footer } from "@/components/landing/footer"
import { Nav } from "@/components/landing/nav"
import { RAIL_V_STYLE } from "@/components/landing/rail-styles"
import { ScrollToTop } from "@/components/landing/scroll-to-top"
import { COMPARISONS, COMPARISONS_CHECKED_AT } from "@/lib/compare/comparisons"

const CONTENT_WIDTH =
  "mx-auto max-w-[76rem] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"

export const metadata: Metadata = {
  title: "Compare — Tokokino vs other screenshot tools",
  description:
    "Side-by-side comparisons of Tokokino against PostSpark, Pika, Shots.so, and Canva — export quality, animation, templates, watermarks, and what each one charges for.",
  alternates: { canonical: "/compare" },
}

export default function CompareIndexPage() {
  return (
    <main
      className="relative isolate min-h-svh bg-background text-foreground"
      style={
        {
          "--rail": "color-mix(in oklch, var(--foreground) 20%, transparent)",
        } as React.CSSProperties
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
              {"// Comparison"}
            </span>
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              Compare
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-7 text-foreground/58">
              Plain-language breakdowns of how Tokokino stacks up against the
              other tools people use to make screenshots look good — including
              where the other tool is the better pick.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2">
            {COMPARISONS.map((entry) => (
              <Link
                key={entry.slug}
                href={`/compare/${entry.slug}`}
                className="group rounded-[14px] border border-border/60 bg-background/40 p-1.5 backdrop-blur-sm transition-colors hover:border-primary/45"
              >
                <div className="flex h-full flex-col justify-between gap-6 rounded-[8px] border border-border/40 bg-background/60 p-5">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] tracking-[0.24em] text-foreground/36 uppercase">
                      Versus {entry.competitor}
                    </p>
                    <h2 className="text-base font-medium tracking-tight transition-colors group-hover:text-primary sm:text-lg">
                      Tokokino vs {entry.competitor}
                    </h2>
                    <p className="text-[13px] leading-6 text-foreground/54">
                      {entry.summary}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-foreground/36 uppercase transition-colors group-hover:text-primary">
                    Read the breakdown →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-xs leading-6 text-foreground/40">
            Every other product here is worth using — these pages describe what
            is free versus paid rather than quoting prices, because plan details
            move around. Claims were checked in {COMPARISONS_CHECKED_AT}.
          </p>
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
